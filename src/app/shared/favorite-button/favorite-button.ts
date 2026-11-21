// shared/favorite-button/favorite-button.ts
// Drop-in ❤️ button. Usage in any template:
//   <app-favorite-button [propertyId]="property.id"></app-favorite-button>
//   <app-favorite-button [propertyId]="property.id" variant="pill"></app-favorite-button>
import { CommonModule } from '@angular/common';
import { Component, Input, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { UserListsService } from '../../core/services/user-lists.service';

@Component({
  selector: 'app-favorite-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      type="button"
      class="fav-btn"
      [class.pill]="variant === 'pill'"
      [class.saved]="saved"
      [class.busy]="busy()"
      [attr.aria-pressed]="saved"
      [attr.aria-label]="saved ? 'Remove from saved hostels' : 'Save hostel'"
      [title]="saved ? 'Remove from saved' : 'Save hostel'"
      (click)="toggle($event)">
      <svg width="18" height="18" viewBox="0 0 24 24" [attr.fill]="saved ? 'currentColor' : 'none'"
           stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
      <span *ngIf="variant === 'pill'">{{ saved ? 'Saved' : 'Save' }}</span>
    </button>
  `,
  styles: [`
    :host { display: inline-block; }
    .fav-btn {
      display: inline-flex; align-items: center; justify-content: center; gap: .4rem;
      width: 38px; height: 38px; padding: 0;
      border-radius: 50%; border: none; cursor: pointer;
      background: rgba(255,255,255,.95); color: #6B7280;
      box-shadow: 0 2px 8px rgba(0,0,0,.15);
      transition: transform .15s ease, color .15s ease, background .15s ease;
      font-family: 'Plus Jakarta Sans', sans-serif;
    }
    .fav-btn:hover { transform: scale(1.08); color: #EF4444; }
    .fav-btn.saved { color: #EF4444; }
    .fav-btn.saved svg { animation: pop .3s ease; }
    .fav-btn.busy { pointer-events: none; opacity: .7; }
    .fav-btn.pill {
      width: auto; height: auto; padding: .6rem 1.1rem; border-radius: 10px;
      border: 1.5px solid #D1D5DB; box-shadow: none; font-weight: 600; font-size: .9rem; color: #374151;
    }
    .fav-btn.pill:hover { border-color: #EF4444; color: #EF4444; transform: none; }
    .fav-btn.pill.saved { border-color: #FCA5A5; background: #FEF2F2; color: #EF4444; }
    @keyframes pop { 0% { transform: scale(1); } 50% { transform: scale(1.3); } 100% { transform: scale(1); } }
  `],
})
export class FavoriteButton {
  @Input({ required: true }) propertyId!: number | string;
  @Input() variant: 'icon' | 'pill' = 'icon';

  private auth = inject(AuthService);
  private lists = inject(UserListsService);
  private router = inject(Router);

  busy = signal(false);

  get saved(): boolean {
    return this.lists.isFavorite(this.propertyId);
  }

  toggle(event: Event): void {
    // the button usually sits inside a clickable card / link
    event.preventDefault();
    event.stopPropagation();

    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }

    this.busy.set(true);
    this.lists.toggleFavorite(this.propertyId).subscribe({
      next: () => this.busy.set(false),
      error: () => this.busy.set(false),
    });
  }
}
