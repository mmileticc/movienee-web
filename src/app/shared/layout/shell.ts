import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { SessionStore } from '../../core/auth/session.store';
import { LanguageService } from '../../core/prefs/language.service';
import { ThemeService } from '../../core/prefs/theme.service';
import { SocialStore } from '../../core/state/social.store';
import { avatarUrl } from '../../core/util/image-url';
import { Snackbar } from '../ui/snackbar';

interface NavItem {
  path: string;
  labelKey: string;
  icon: string;
  exact: boolean;
}

/**
 * App frame: a top bar (brand, desktop navigation, language/theme toggles, account) and, on narrow
 * screens, a bottom navigation like the Android app. Every screen renders inside the router outlet.
 */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslocoPipe, Snackbar],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {
  protected readonly session = inject(SessionStore);
  protected readonly language = inject(LanguageService);
  protected readonly theme = inject(ThemeService);
  /** Also starts the badge polling for a signed-in user. */
  protected readonly social = inject(SocialStore);

  protected readonly navItems: NavItem[] = [
    { path: '/', labelKey: 'nav_home', icon: 'home', exact: true },
    { path: '/search', labelKey: 'nav_search', icon: 'search', exact: false },
    { path: '/library', labelKey: 'nav_library', icon: 'video_library', exact: false },
    { path: '/friends', labelKey: 'nav_friends', icon: 'group', exact: false },
    { path: '/profile', labelKey: 'nav_profile', icon: 'person', exact: false },
  ];

  /** Badge number per navigation item (incoming friend requests on Friends). */
  protected badge(path: string): number {
    return path === '/friends' && this.session.isSignedIn() ? this.social.incoming().length : 0;
  }

  /** The language the toggle switches to; also starts its accessible name (it is the visible text). */
  protected readonly otherLanguage = computed(() =>
    this.language.language() === 'sr' ? 'EN' : 'SR',
  );

  protected readonly year = new Date().getFullYear();

  protected readonly avatar = computed(() => avatarUrl(this.session.user()?.avatarUrl));

  protected readonly themeIcon = computed(
    () =>
      ({ system: 'brightness_auto', dark: 'dark_mode', light: 'light_mode' })[this.theme.option()],
  );
  protected readonly themeLabelKey = computed(() => `web_theme_${this.theme.option()}`);
}
