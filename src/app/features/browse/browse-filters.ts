import { ChangeDetectionStrategy, Component, inject, input, model } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Genre } from '../../core/models/movie';
import { BrowsePrefsService } from '../../core/prefs/browse-prefs.service';

/**
 * Filter bar of the "See all" screens: title search, the grid/list switch and multi-select genre
 * chips. Screen-specific filters are projected below.
 */
@Component({
  selector: 'app-browse-filters',
  imports: [TranslocoPipe],
  template: `
    <div class="top">
      <div class="search">
        <span class="icon" aria-hidden="true">search</span>
        <input
          class="text-input"
          type="search"
          [value]="query()"
          (input)="query.set($any($event.target).value)"
          [placeholder]="'browse_search_placeholder' | transloco"
          [attr.aria-label]="'browse_search_placeholder' | transloco"
        />
      </div>
      <button
        class="icon-btn view"
        type="button"
        (click)="prefs.toggle()"
        [attr.aria-label]="
          (prefs.viewMode() === 'grid' ? 'browse_view_as_list' : 'browse_view_as_grid') | transloco
        "
        [title]="
          (prefs.viewMode() === 'grid' ? 'browse_view_as_list' : 'browse_view_as_grid') | transloco
        "
      >
        <span class="icon" aria-hidden="true">{{
          prefs.viewMode() === 'grid' ? 'view_list' : 'grid_view'
        }}</span>
      </button>
    </div>

    @if (genres().length > 0) {
      <div class="chips" role="group" [attr.aria-label]="'movie_detail_genres_header' | transloco">
        @for (genre of genres(); track genre.id) {
          <button
            class="chip"
            type="button"
            [attr.aria-pressed]="selectedGenres().includes(genre.id)"
            (click)="toggleGenre(genre.id)"
          >
            {{ genre.name }}
          </button>
        }
      </div>
    }
    <ng-content />
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--space-3);
      margin-bottom: var(--space-5);
    }
    .top {
      display: flex;
      gap: var(--space-2);
      align-items: center;
    }
    .search {
      position: relative;
      flex: 1;
      max-width: 560px;
      .icon {
        position: absolute;
        left: var(--space-4);
        top: 50%;
        translate: 0 -50%;
        color: var(--text-muted);
        pointer-events: none;
      }
      .text-input {
        padding-left: 48px;
      }
    }
    .view {
      border: 1px solid var(--border);
    }
    .chips {
      display: flex;
      gap: var(--space-2);
      overflow-x: auto;
      padding-bottom: var(--space-1);
      scrollbar-width: thin;
    }
    // Phones scroll the chips by swiping; the scrollbar only adds a stray line there.
    @media (pointer: coarse) {
      .chips {
        scrollbar-width: none;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BrowseFilters {
  protected readonly prefs = inject(BrowsePrefsService);

  readonly genres = input.required<Genre[]>();
  readonly query = model('');
  readonly selectedGenres = model<number[]>([]);

  protected toggleGenre(id: number): void {
    const selected = this.selectedGenres();
    this.selectedGenres.set(
      selected.includes(id) ? selected.filter((g) => g !== id) : [...selected, id],
    );
  }
}
