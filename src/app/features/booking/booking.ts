import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';


@Component({
  selector: 'app-booking',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './booking.html',
  styleUrls: ['./booking.css'],
})
export class Booking implements OnInit {
  property = signal<any>(null);
  selectedRoomId = signal<number | null>(null);
  loading = signal(true);
  submitting = signal(false);
  error = signal<string | null>(null);
  success = signal<any>(null);

  checkInDate = '';
  durationMonths = 1;

  private propertyId!: string;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService,
    public auth: AuthService
  ) {}

  ngOnInit(): void {
    // Booking always requires login — bounce anonymous visitors straight
    // to login with a returnUrl back to this exact booking page.
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }

    this.propertyId = this.route.snapshot.paramMap.get('propertyId') || '';
    const roomParam = this.route.snapshot.queryParamMap.get('room');

    // Default check-in date: tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    this.checkInDate = tomorrow.toISOString().slice(0, 10);

    this.api.getPropertyById(this.propertyId).subscribe({
      next: (res: { data: { rooms: any[]; }; }) => {
        this.property.set(res.data);
        const rooms = res.data.rooms || [];
        const preselect = roomParam ? Number(roomParam) : rooms[0]?.id ?? null;
        this.selectedRoomId.set(preselect);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('We couldn\u2019t load this property. Please try again.');
        this.loading.set(false);
      },
    });
  }

  get selectedRoom(): any {
    const p = this.property();
    if (!p) return null;
    return (p.rooms || []).find((r: any) => r.id === this.selectedRoomId()) || null;
  }

  submit(): void {
    const p = this.property();
    const roomId = this.selectedRoomId();
    if (!p || !roomId || !this.checkInDate) return;

    this.submitting.set(true);
    this.error.set(null);

    this.api.createBooking({
      property_id: p.id,
      room_id: roomId,
      check_in_date: this.checkInDate,
      duration_months: this.durationMonths,
    }).subscribe({
      next: (res: { data: any; }) => {
        this.success.set(res.data);
        this.submitting.set(false);
      },
      error: (err: { error: { message: any; }; }) => {
        this.error.set(err?.error?.message || 'Something went wrong. Please try again.');
        this.submitting.set(false);
      },
    });
  }
}
