import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom, of } from 'rxjs';
import { UserApi } from '../../core/api/user-api';
import { AuthService } from '../../core/auth/auth.service';
import { SessionStore } from '../../core/auth/session.store';
import { FriendlyError, friendlyError } from '../../core/http/friendly-error';
import { UserProfile } from '../../core/models/user';
import { LanguageOption, LanguageService } from '../../core/prefs/language.service';
import { ThemeOption, ThemeService } from '../../core/prefs/theme.service';
import { PwaService } from '../../core/pwa/pwa.service';
import { formatRating } from '../../core/util/format';
import { compressImage, toDataUri } from '../../core/util/image-compress';
import { avatarUrl } from '../../core/util/image-url';
import { PageTitle } from '../../core/util/page-title';
import { UsernameProblem, sanitizeUsername, validateUsername } from '../../core/util/username';
import { ConfirmService } from '../../shared/ui/confirm-dialog';
import { SnackbarService } from '../../shared/ui/snackbar';
import { ErrorState, Spinner } from '../../shared/ui/states';

const BIO_MAX_LENGTH = 160;
const AVATAR_MAX_DIMENSION = 480;
const AVATAR_MAX_BYTES = 150 * 1024;
const VISIBLE_GENRES = 3;

/**
 * Own profile and settings (ProfileScreen / SettingsTab): header with statistics, editing the
 * username, status line and picture, "Your taste" and the app settings (language, theme). Signed out,
 * it offers sign-in and still lets the visitor change the language and theme.
 */
@Component({
  selector: 'app-profile',
  imports: [TranslocoPipe, RouterLink, ErrorState, Spinner],
  templateUrl: './profile.page.html',
  styleUrl: './profile.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilePage {
  private readonly userApi = inject(UserApi);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly confirmService = inject(ConfirmService);
  private readonly snackbar = inject(SnackbarService);
  protected readonly session = inject(SessionStore);
  protected readonly language = inject(LanguageService);
  protected readonly theme = inject(ThemeService);
  protected readonly pwa = inject(PwaService);

  protected readonly bioMax = BIO_MAX_LENGTH;
  protected readonly languageOptions: LanguageOption[] = ['system', 'sr', 'en'];
  protected readonly themeOptions: ThemeOption[] = ['system', 'dark', 'light'];

  protected readonly profile = rxResource({
    params: () => this.session.userId(),
    stream: ({ params }) => (params ? this.userApi.profile() : of(null)),
  });
  protected readonly taste = rxResource({
    params: () => this.session.userId(),
    stream: ({ params }) => (params ? this.userApi.tasteProfile() : of([])),
  });

  protected readonly profileError = computed(() =>
    this.profile.error() ? friendlyError(this.profile.error(), 'error_load_profile') : null,
  );
  protected readonly avatar = computed(() =>
    avatarUrl(this.profile.value()?.avatar ?? this.session.user()?.avatarUrl),
  );

  /** "Your taste": the top genres always, the rest behind "Show N more". */
  protected readonly showAllGenres = signal(false);
  protected readonly genres = computed(() => {
    const all = [...(this.taste.value() ?? [])].sort((a, b) => b.average_rating - a.average_rating);
    return this.showAllGenres() ? all : all.slice(0, VISIBLE_GENRES);
  });
  protected readonly hiddenGenreCount = computed(
    () => (this.taste.value()?.length ?? 0) - VISIBLE_GENRES,
  );

  // Edit form.
  protected readonly editing = signal(false);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<FriendlyError | null>(null);
  protected readonly username = signal('');
  protected readonly bio = signal('');
  protected readonly pickedAvatar = signal<string | null>(null);
  protected readonly usernameProblem = computed<UsernameProblem | null>(() =>
    validateUsername(this.username().trim()),
  );
  protected readonly canSave = computed(
    () => !this.saving() && !this.usernameProblem() && this.hasChanges(),
  );

  constructor() {
    inject(PageTitle).set(this.transloco.translate('profile_top_bar_title'));
  }

  protected startEditing(profile: UserProfile): void {
    // A never-customized name may be a raw Google name ("Miloš Miletić"); start from a valid one.
    this.username.set(
      validateUsername(profile.username) ? sanitizeUsername(profile.username) : profile.username,
    );
    this.bio.set(profile.bio ?? '');
    this.pickedAvatar.set(null);
    this.saveError.set(null);
    this.editing.set(true);
  }

  protected async cancelEditing(): Promise<void> {
    if (this.hasChanges()) {
      const discard = await this.confirmService.confirm({
        title: this.transloco.translate('profile_discard_dialog_title'),
        message: this.transloco.translate('profile_discard_dialog_message'),
        confirmLabel: this.transloco.translate('profile_discard_confirm'),
        cancelLabel: this.transloco.translate('profile_discard_keep_editing'),
        destructive: true,
      });
      if (!discard) return;
    }
    this.editing.set(false);
  }

  protected onBioInput(value: string): void {
    // Longer pasted text is cut to the limit instead of being rejected.
    this.bio.set(value.slice(0, BIO_MAX_LENGTH));
  }

  protected async onAvatarPicked(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const compressed = await compressImage(file, AVATAR_MAX_DIMENSION, AVATAR_MAX_BYTES);
      this.pickedAvatar.set(await toDataUri(compressed));
    } catch {
      this.snackbar.show(this.transloco.translate('profile_avatar_pick_error'));
    }
  }

  protected save(event: Event): void {
    event.preventDefault();
    if (!this.canSave()) return;
    this.saving.set(true);
    this.saveError.set(null);
    this.userApi
      .updateProfile({
        username: this.username().trim(),
        bio: this.bio().trim() || null,
        // null keeps the current picture; only a newly picked one is sent.
        avatar: this.pickedAvatar(),
      })
      .subscribe({
        next: (updated) => {
          this.profile.set(updated);
          this.session.updateIdentity(updated.username, updated.avatar ?? null);
          this.saving.set(false);
          this.editing.set(false);
        },
        error: (e) => {
          this.saveError.set(friendlyError(e, 'error_profile_not_saved'));
          this.saving.set(false);
        },
      });
  }

  /** The browser's own install dialog (the button is shown only where it is available). */
  protected install(): void {
    void this.pwa.install();
  }

  protected readonly deleting = signal(false);

  /**
   * Deletes the account after an explicit confirmation. Only after the server confirmed is the
   * session cleared; a failure leaves the user signed in with a message.
   */
  protected async deleteAccount(): Promise<void> {
    const confirmed = await this.confirmService.confirm({
      title: this.transloco.translate('web_delete_account_title'),
      message: this.transloco.translate('web_delete_account_message'),
      confirmLabel: this.transloco.translate('web_delete_account'),
      cancelLabel: this.transloco.translate('profile_cancel_edit'),
      destructive: true,
    });
    if (!confirmed) return;
    this.deleting.set(true);
    try {
      await firstValueFrom(this.userApi.deleteAccount(), { defaultValue: undefined });
    } catch {
      this.deleting.set(false);
      this.snackbar.show(this.transloco.translate('web_delete_account_failed'));
      return;
    }
    await this.auth.signOut().catch(() => undefined);
    this.snackbar.show(this.transloco.translate('web_account_deleted'));
    void this.router.navigateByUrl('/');
  }

  protected async signOut(): Promise<void> {
    const confirmed = await this.confirmService.confirm({
      title: this.transloco.translate('profile_sign_out_dialog_title'),
      message: this.transloco.translate('profile_sign_out_dialog_message'),
      confirmLabel: this.transloco.translate('profile_sign_out'),
      cancelLabel: this.transloco.translate('profile_cancel_edit'),
    });
    if (!confirmed) return;
    await this.auth.signOut();
    void this.router.navigateByUrl('/');
  }

  protected tasteValue(average: number, count: number): string {
    return this.transloco.translate('profile_taste_rating_count', {
      p1: formatRating(average, this.language.language()) ?? '-',
      p2: count,
    });
  }

  protected usernameError(problem: UsernameProblem): string {
    return `profile_username_${problem === 'invalid_chars' ? 'invalid_chars' : problem}`;
  }

  protected errorText(error: FriendlyError): string {
    return error.message ?? this.transloco.translate(error.key ?? 'error_profile_not_saved');
  }

  private hasChanges(): boolean {
    const profile = this.profile.value();
    if (!profile) return false;
    return (
      this.username().trim() !== profile.username ||
      this.bio().trim() !== (profile.bio ?? '') ||
      this.pickedAvatar() !== null
    );
  }
}
