import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';

/** Sets the browser tab title as "<page> · Movienee". */
@Injectable({ providedIn: 'root' })
export class PageTitle {
  private readonly title = inject(Title);

  set(page: string | null | undefined): void {
    this.title.setTitle(page ? `${page} · Movienee` : 'Movienee');
  }
}
