import { DatePipe, JsonPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { BookingLog, BookingLogService } from '../../core/booking-log.service';

@Component({
  selector: 'app-logs',
  imports: [DatePipe, JsonPipe, FormsModule, MatButtonModule],
  template: `
    <h1>Logs</h1>
    <p>Booking progress and failures. Browser reports are diagnostic; server events confirm API outcomes.</p>
    <div class="filters">
      <label>Day (UTC)<input type="date" [(ngModel)]="day"></label>
      <label>Attempt / booking reference<input type="search" [ngModel]="search()" (ngModelChange)="search.set($event)" placeholder="Search loaded events"></label>
      <button mat-flat-button (click)="load()" [disabled]="loading()">Refresh</button>
    </div>
    <p>Events are retained for 90 days. A missing confirmation may mean an unfinished attempt or lost telemetry, not necessarily a failed payment.</p>
    @if (error()) { <p role="alert">{{ error() }}</p> }
    @if (loading()) { <p role="status">Loading logs...</p> }
    <div class="table-wrap"><table>
      <thead><tr><th>Time</th><th>Attempt</th><th>Event</th><th>Source</th><th>Progress / details</th></tr></thead>
      <tbody>
        @for (item of filtered(); track $index) {
          <tr><td>{{ item.createdAt | date:'medium':'UTC' }} UTC</td>
          <td><button class="reference" (click)="search.set(item.attemptId)">{{ item.attemptId }}</button></td>
          <td>{{ item.event }}</td><td>{{ item.source }}</td><td><pre>{{ item.details | json }}</pre></td></tr>
        } @empty { @if (!loading() && !error()) { <tr><td colspan="5">No matching events. Refresh or load more events.</td></tr> } }
      </tbody>
    </table></div>
    @if (cursor()) { <button mat-stroked-button (click)="load(true)" [disabled]="loading()">Load more</button> }
  `,
  styles: [`:host{display:block;color:#162236}h1{font-size:2rem;margin-bottom:8px}p{color:#526179}.filters{display:flex;gap:16px;align-items:end;flex-wrap:wrap;margin:24px 0}label{display:grid;gap:8px;font-weight:600}input{font:inherit;padding:12px;border:1px solid #ccd5e0;border-radius:8px;min-width:220px}.table-wrap{overflow:auto;background:white;border:1px solid #e0e6ef;border-radius:12px;margin:20px 0}table{border-collapse:collapse;width:100%;font-size:14px}th,td{text-align:left;padding:16px;border-bottom:1px solid #e0e6ef;vertical-align:top}th{background:#f3f6fa}pre{white-space:pre-wrap;min-width:240px;margin:0;font-size:13px}.reference{font:inherit;color:#275cc6;background:none;border:0;cursor:pointer;overflow-wrap:anywhere;text-align:left} [role=alert]{color:#b42318}`],
})
export class LogsComponent {
  private readonly logs = inject(BookingLogService);
  day = new Date().toISOString().slice(0, 10);
  readonly search = signal('');
  readonly items = signal<BookingLog[]>([]);
  readonly cursor = signal<string | undefined>(undefined);
  readonly loading = signal(false);
  readonly error = signal('');
  private loadedDay = '';
  readonly filtered = computed(() => this.items().filter(item =>
    JSON.stringify(item).toLowerCase().includes(this.search().trim().toLowerCase())));
  constructor() { void this.load(); }
  async load(more = false): Promise<void> {
    if (this.loading()) return;
    more = more && this.loadedDay === this.day;
    this.loading.set(true);
    this.error.set('');
    if (!more) { this.items.set([]); this.cursor.set(undefined); }
    const day = this.day;
    try {
      const result = await this.logs.list(day, more ? this.cursor() : undefined);
      this.items.update(items => more ? [...items, ...result.items] : result.items);
      this.cursor.set(result.cursor);
      this.loadedDay = day;
    } catch {
      this.error.set('Logs could not be loaded. Check your staff session and try again.');
    } finally { this.loading.set(false); }
  }
}
