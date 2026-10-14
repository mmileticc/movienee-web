import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { TmdbMatch, VisionSearchResponse } from '../../core/models/vision';
import { releaseYear, tmdbImage } from '../../core/util/image-url';

interface MatchEntry {
  match: TmdbMatch;
  /** The candidate's confidence as a percentage (0-100), or null when unknown. */
  percent: number | null;
}

/** Only real TMDB ids end up in a link (the response comes from an AI pipeline). */
function isValidId(id: unknown): id is number {
  return typeof id === 'number' && Number.isInteger(id) && id > 0;
}

function toPercent(confidence: number | null | undefined): number | null {
  return typeof confidence === 'number' && Number.isFinite(confidence)
    ? Math.round(Math.min(1, Math.max(0, confidence)) * 100)
    : null;
}

/**
 * Image search result (VisionResults.kt): the best match as a large card; every other match of all
 * candidates is collapsed behind "Show N more possible matches".
 */
@Component({
  selector: 'app-vision-results',
  imports: [TranslocoPipe, RouterLink],
  template: `
    <section class="vision" [attr.aria-label]="'search_vision_result_title' | transloco">
      <div class="head">
        <h2 class="t-title-lg">{{ 'search_vision_result_title' | transloco }}</h2>
        <button class="link" type="button" (click)="cleared.emit()">
          {{ 'search_vision_clear' | transloco }}
        </button>
      </div>
      <p class="t-body t-secondary">
        {{
          (response().notMovieLike
            ? 'search_vision_not_movie_like'
            : 'search_vision_success_message'
          ) | transloco
        }}
      </p>

      @if (hero(); as best) {
        <p class="t-small t-muted label">{{ 'search_vision_best_match_label' | transloco }}</p>
        <a class="hero" [routerLink]="['/movie', best.match.id]">
          <span class="poster">
            @if (poster(best.match, 'w342'); as src) {
              <img [src]="src" alt="" width="90" height="135" loading="lazy" />
            } @else {
              <span class="icon" aria-hidden="true">movie</span>
            }
          </span>
          <span class="info">
            <span class="t-title">{{ best.match.title }}</span>
            @if (best.percent !== null) {
              <span class="percent">{{
                'search_vision_match_percent' | transloco: { p1: best.percent }
              }}</span>
            }
            @if (year(best.match); as y) {
              <span class="t-body t-secondary">{{ y }}</span>
            }
            @if (cinemas(best.match).length > 0) {
              <span class="chips">
                @for (name of cinemas(best.match); track name) {
                  <span class="chip">{{ name }}</span>
                }
              </span>
            }
          </span>
        </a>

        @if (others().length > 0) {
          <button
            class="more"
            type="button"
            [attr.aria-expanded]="expanded()"
            (click)="expanded.set(!expanded())"
          >
            {{
              expanded()
                ? ('search_vision_hide_matches' | transloco)
                : ('search_vision_show_more_matches' | transloco: { p1: others().length })
            }}
            <span class="icon" aria-hidden="true">{{
              expanded() ? 'expand_less' : 'expand_more'
            }}</span>
          </button>
          @if (expanded()) {
            <ul class="others">
              @for (entry of others(); track entry.match.id) {
                <li>
                  <a class="row" [routerLink]="['/movie', entry.match.id]">
                    <span class="poster small">
                      @if (poster(entry.match, 'w92'); as src) {
                        <img [src]="src" alt="" width="40" height="60" loading="lazy" />
                      }
                    </span>
                    <span class="info">
                      <span class="t-body title">{{ entry.match.title }}</span>
                      @if (entry.percent !== null) {
                        <span class="percent t-small">{{
                          'search_vision_match_percent' | transloco: { p1: entry.percent }
                        }}</span>
                      }
                      @if (meta(entry.match); as text) {
                        <span class="t-small t-secondary">{{ text }}</span>
                      }
                    </span>
                  </a>
                </li>
              }
            </ul>
          }
        }
      } @else {
        <p class="t-body">{{ 'search_vision_no_hero' | transloco }}</p>
      }
    </section>
  `,
  styleUrl: './vision-results.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VisionResults {
  readonly response = input.required<VisionSearchResponse>();
  readonly cleared = output<void>();

  protected readonly expanded = signal(false);

  private readonly entries = computed<MatchEntry[]>(() => {
    const seen = new Set<number>();
    const result: MatchEntry[] = [];
    for (const resolution of this.response().resolutions ?? []) {
      const percent = toPercent(resolution.candidate?.confidence);
      for (const match of resolution.matches ?? []) {
        if (!isValidId(match.id) || seen.has(match.id)) continue;
        seen.add(match.id);
        result.push({ match, percent });
      }
    }
    return result;
  });

  protected readonly hero = computed(() => this.entries()[0] ?? null);
  protected readonly others = computed(() => this.entries().slice(1));

  protected poster(match: TmdbMatch, size: 'w92' | 'w342'): string | null {
    return tmdbImage(match.posterPath, size);
  }

  protected year(match: TmdbMatch): string | null {
    return releaseYear(match.releaseDate);
  }

  /** "2024 · Cineplexx, Arena" for a secondary row. */
  protected meta(match: TmdbMatch): string {
    return [this.year(match), this.cinemas(match).join(', ')].filter(Boolean).join(' · ');
  }

  /** Distinct cinema names (at most two, like the Android chips). */
  protected cinemas(match: TmdbMatch): string[] {
    return [...new Set((match.cinemaShowtimes ?? []).map((s) => s.cinemaName))].slice(0, 2);
  }
}
