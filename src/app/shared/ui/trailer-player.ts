import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { TranslocoPipe } from '@jsverse/transloco';
import { MovieVideo } from '../../core/models/movie';

/**
 * The movie's trailer(s) (YouTubeTrailerPlayer.kt). Shows a thumbnail first and loads the YouTube
 * player only on click, so the page does not download the player (and uses no data) until wanted.
 * With several videos, chips above the player pick one. Uses youtube-nocookie.com.
 */
@Component({
  selector: 'app-trailer-player',
  imports: [TranslocoPipe],
  template: `
    @if (videos().length > 1) {
      <div class="chips" role="tablist">
        @for (video of videos(); track video.key; let i = $index) {
          <button
            type="button"
            class="chip"
            role="tab"
            [attr.aria-selected]="i === selectedIndex()"
            (click)="select(i)"
          >
            {{ video.name || video.type || 'Trailer' }}
          </button>
        }
      </div>
    }
    <div class="frame">
      @if (playing() && embedUrl(); as url) {
        <iframe
          [src]="url"
          [title]="selected()?.name ?? 'Trailer'"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowfullscreen
        ></iframe>
      } @else if (selected(); as video) {
        <button class="facade" type="button" (click)="playing.set(true)">
          <img [src]="thumbnail(video.key)" alt="" loading="lazy" />
          <span class="play"><span class="icon filled" aria-hidden="true">play_arrow</span></span>
          <span class="sr-only">{{ video.name }}</span>
        </button>
      }
    </div>
    @if (selected(); as video) {
      <a
        class="youtube"
        [href]="'https://www.youtube.com/watch?v=' + video.key"
        target="_blank"
        rel="noopener"
        >{{ 'movie_detail_open_youtube' | transloco }}</a
      >
    }
  `,
  styleUrl: './trailer-player.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrailerPlayer {
  private readonly sanitizer = inject(DomSanitizer);

  readonly videos = input.required<MovieVideo[]>();

  protected readonly selectedIndex = signal(0);
  protected readonly playing = signal(false);
  protected readonly selected = computed<MovieVideo | null>(
    () => this.videos()[this.selectedIndex()] ?? null,
  );

  protected readonly embedUrl = computed<SafeResourceUrl | null>(() => {
    const video = this.selected();
    if (!video) return null;
    // The key comes from TMDB; only YouTube ids ([A-Za-z0-9_-]) are allowed into the URL.
    const key = video.key.replace(/[^A-Za-z0-9_-]/g, '');
    return this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://www.youtube-nocookie.com/embed/${key}?autoplay=1&rel=0&modestbranding=1`,
    );
  });

  protected select(index: number): void {
    this.selectedIndex.set(index);
    this.playing.set(false);
  }

  protected thumbnail(key: string): string {
    return `https://i.ytimg.com/vi/${encodeURIComponent(key)}/hqdefault.jpg`;
  }
}
