import { DatePipe, JsonPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { presentLog } from './log-presentation';
import { BookingLog, BookingLogService } from '../../core/booking-log.service';

@Component({
  selector: 'app-logs',
  imports: [DatePipe, JsonPipe, FormsModule, MatButtonModule],
  template: `
    <h1>Logs</h1>
    <p>Follow each booking attempt to see what the customer completed and where they needed help.</p>
    <div class="filters">
      <label>Day (UTC)<input type="date" [(ngModel)]="day"></label>
      <label>Search activity or reference<input type="search" [ngModel]="search()" (ngModelChange)="search.set($event)" placeholder="Search events, steps, or references"></label>
      <button mat-flat-button (click)="load()" [disabled]="loading()">Refresh</button>
    </div>
    <p>Showing loaded activity for the selected UTC day, newest first. Logs are kept for 90 days. Browser reports can be incomplete; check booking-service events to confirm the outcome.</p>
    @if (error()) { <p role="alert">{{ error() }}</p> }
    @if (loading()) { <p role="status">Loading logs...</p> }
    <div class="table-wrap"><table>
      <thead><tr><th>Time / reference</th><th>Activity</th><th>Booking progress</th></tr></thead>
      <tbody>
        @for (row of filtered(); track $index) {
          <tr>
            <td class="when"><time>{{ row.item.createdAt | date:'MMM d, y':'UTC' }}<br><strong>{{ row.item.createdAt | date:'h:mm:ss a':'UTC' }}</strong> UTC</time>
              <span class="reference-label">Attempt reference</span>
              <button class="reference" (click)="search.set(row.item.attemptId)" title="Show this booking attempt">{{ row.item.attemptId }}</button>
              @if (row.item.details['bookingId']) { <span class="reference-label">Booking reference</span><strong>{{ row.item.details['bookingId'] }}</strong> }
            </td>
            <td class="activity"><span class="status" [class]="'status ' + row.tone">{{ row.status }}</span><h2>{{ row.title }}</h2><span class="source">Reported by {{ row.source }}</span>
              @for (note of row.notes; track $index) { <p class="note">{{ note }}</p> }
            </td>
            <td class="progress">
              @if (row.completed.length) { <h3>Completed steps</h3><ul class="step-list completed">@for (step of row.completed; track $index) { <li>{{ step }}</li> }</ul> }
              @if (row.pending.length) { <h3>Still needed</h3><ul class="step-list pending">@for (step of row.pending; track $index) { <li>{{ step }}</li> }</ul> }
              @if (row.item.event === 'progress' && row.item.details['blockers'] === '') { <p>All required steps are ready.</p> }
              <details><summary>Technical details</summary><dl><dt>Event code</dt><dd>{{ row.item.event }}</dd><dt>Source</dt><dd>{{ row.item.source }}</dd></dl><pre>{{ row.item.details | json }}</pre></details>
            </td>
          </tr>
        } @empty { @if (!loading() && !error()) { <tr><td colspan="3">No matching activity. Try another search, refresh, or load more events.</td></tr> } }
      </tbody>
    </table></div>
    @if (cursor()) { <button mat-stroked-button (click)="load(true)" [disabled]="loading()">Load more</button> }
  `,
  styles: [`:host{display:block;color:#162236}h1{font-size:2rem;margin-bottom:8px}p{color:#526179}.filters{display:flex;gap:16px;align-items:end;flex-wrap:wrap;margin:24px 0}label{display:grid;gap:8px;font-weight:600}input{font:inherit;padding:12px;border:1px solid #ccd5e0;border-radius:8px;min-width:220px}.table-wrap{overflow:auto;background:white;border:1px solid #e0e6ef;border-radius:12px;margin:20px 0}table{border-collapse:collapse;width:100%;font-size:14px}th,td{text-align:left;padding:16px;border-bottom:1px solid #e0e6ef;vertical-align:top}th{background:#f3f6fa}pre{white-space:pre-wrap;min-width:240px;margin:0;font-size:13px}.reference{font:inherit;color:#275cc6;background:none;border:0;cursor:pointer;overflow-wrap:anywhere;text-align:left} [role=alert]{color:#b42318}.when{min-width:200px;max-width:240px}.reference-label{display:block;color:#526179;font-size:12px;margin-top:14px;margin-bottom:4px}.reference{padding:0;font-size:13px}.activity{min-width:240px;max-width:390px}h2{font-size:16px;margin:10px 0 6px}h3{font-size:14px;margin:0 0 8px}.source{color:#526179;font-size:13px}.note{line-height:1.6;margin:12px 0 0}.status{display:inline-block;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:600;background:#eef2f6;color:#43516a}.status.error{background:#fff0ed;color:#a62b17}.status.success{background:#e8f7ee;color:#17683c}.progress{min-width:280px}.step-list{display:flex;flex-wrap:wrap;gap:6px;list-style:none;padding:0;margin:0 0 16px}.step-list li{padding:5px 9px;border-radius:6px;font-size:13px}.completed li{background:#e8f7ee;color:#17683c}.pending li{background:#fff4dd;color:#805400}details{margin-top:14px;color:#526179}summary{cursor:pointer;font-size:13px}dl{font-size:13px}dt{font-weight:600}dd{margin:4px 0 8px}pre{background:#f3f6fa;padding:12px;border-radius:6px}`],
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
  readonly filtered = computed(() => this.items().map(presentLog).filter(row =>
    JSON.stringify(row).toLowerCase().includes(this.search().trim().toLowerCase())));
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
