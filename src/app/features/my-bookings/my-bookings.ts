// features/my-bookings/my-bookings.ts  →  route: /bookings
import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { UserListsService } from '../../core/services/user-lists.service';
import { BookingGroup, BookingView, PROPERTY_DETAIL_ROUTE, toBookingView } from '../../core/utils/property-view';

type Tab = 'all' | BookingGroup;

@Component({
  selector: 'app-my-bookings',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './my-bookings.html',
  styleUrls: ['./my-bookings.css'],
})
export class MyBookings implements OnInit {
  auth = inject(AuthService);
  private lists = inject(UserListsService);
  private router = inject(Router);

  readonly detailRoute = PROPERTY_DETAIL_ROUTE;

  loading = signal(true);
  error = signal<string | null>(null);
  bookings = signal<BookingView[]>([]);
  tab = signal<Tab>('all');

  tabs: { key: Tab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'active', label: 'Current Stay' },
    { key: 'past', label: 'Past' },
    { key: 'cancelled', label: 'Cancelled' },
  ];

  counts = computed(() => {
    const c: Record<Tab, number> = { all: 0, upcoming: 0, active: 0, past: 0, cancelled: 0 };
    for (const b of this.bookings()) {
      c.all++;
      c[b.group]++;
    }
    return c;
  });

  filtered = computed(() => {
    const t = this.tab();
    return t === 'all' ? this.bookings() : this.bookings().filter((b) => b.group === t);
  });

  ngOnInit(): void {
    if (!this.auth.isBrowser) return;

    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: '/bookings' } });
      return;
    }
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.lists.getMyBookings().subscribe({
      next: (rows) => {
        this.bookings.set(rows.map(toBookingView));
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'Could not load your bookings.');
        this.loading.set(false);
      },
    });
  }

  setTab(t: Tab): void {
    this.tab.set(t);
  }

  statusLabel(status: string): string {
    return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  statusClass(b: BookingView): string {
    if (b.group === 'cancelled') return 'st-cancelled';
    if (/confirm|approved|active|checked_in/.test(b.status)) return 'st-confirmed';
    if (/complete|checked_out/.test(b.status)) return 'st-completed';
    return 'st-pending';
  }
}
