import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { VisionSearchResponse } from '../models/vision';
import { apiUrl } from './api-base';

/** Image recognition: uploads a (compressed) photo of a poster or film still. Requires sign-in. */
@Injectable({ providedIn: 'root' })
export class VisionApi {
  private readonly http = inject(HttpClient);

  detect(image: Blob): Observable<VisionSearchResponse> {
    const form = new FormData();
    form.append('image', image, 'image.jpg');
    return this.http.post<VisionSearchResponse>(apiUrl('/chat/vision'), form);
  }
}
