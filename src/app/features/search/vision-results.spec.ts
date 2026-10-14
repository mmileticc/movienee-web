import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it } from 'vitest';
import { TmdbMatch, VisionSearchResponse } from '../../core/models/vision';
import { VisionResults } from './vision-results';

const match = (id: number, title = `Movie ${id}`): TmdbMatch => ({
  id,
  title,
  posterPath: null,
  cinemaShowtimes: [],
});

function render(response: VisionSearchResponse): HTMLElement {
  TestBed.configureTestingModule({
    imports: [VisionResults, TranslocoTestingModule.forRoot({ langs: { en: {} } })],
    providers: [provideRouter([])],
  });
  const fixture = TestBed.createComponent(VisionResults);
  fixture.componentRef.setInput('response', response);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('VisionResults', () => {
  it('shows the first valid match as the hero and the rest deduplicated behind "more"', () => {
    const el = render({
      notMovieLike: false,
      resolutions: [
        { candidate: { title: 'A', confidence: 0.91 }, matches: [match(-1), match(10), match(11)] },
        { candidate: { title: 'B', confidence: 7 }, matches: [match(10), match(12)] },
      ],
    });

    const hero = el.querySelector<HTMLAnchorElement>('a.hero')!;
    expect(hero.getAttribute('href')).toBe('/movie/10');
    expect(hero.textContent).toContain('Movie 10');

    (el.querySelector('button.more') as HTMLButtonElement).click();
    TestBed.tick();
    const rows = [...el.querySelectorAll<HTMLAnchorElement>('a.row')];
    expect(rows.map((a) => a.getAttribute('href'))).toEqual(['/movie/11', '/movie/12']);
  });

  it('says so when nothing was recognized', () => {
    const el = render({ notMovieLike: true, resolutions: [] });
    expect(el.querySelector('a.hero')).toBeNull();
    expect(el.textContent).toContain('search_vision_no_hero');
    expect(el.textContent).toContain('search_vision_not_movie_like');
  });
});
