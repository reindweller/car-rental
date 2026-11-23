import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import { environment } from '../../environments/environment';

export interface BookingLog {
  attemptId: string;
  event: string;
  source: 'browser' | 'server';
  createdAt: string;
  details: Record<string, string | number | boolean>;
}

@Injectable({ providedIn: 'root' })
export class BookingLogService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.aws.apiUrl}/booking-logs`;

  record(attemptId: string, event: string, details: BookingLog['details'] = {}): void {
    // Telemetry must never prevent a customer from booking. No customer or card data.
    this.http.post(this.url, { attemptId, event, details }).pipe(timeout(5000)).subscribe({ error: () => {} });
  }

  leave(attemptId: string, completed: boolean): void {
    void fetch(this.url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attemptId, event: 'page_left', details: { completed } }),
      keepalive: true }).catch(() => {});
  }

  list(day: string, cursor?: string): Promise<{ items: BookingLog[]; cursor?: string }> {
    return firstValueFrom(this.http.get<{ items: BookingLog[]; cursor?: string }>(this.url,
      { params: { day, ...(cursor ? { cursor } : {}) } }).pipe(timeout(15000)));
  }
}
