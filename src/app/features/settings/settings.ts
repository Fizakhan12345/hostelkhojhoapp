import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './settings.html',
  styleUrls: ['./settings.css'],
})
export class Settings implements OnInit {
  pw = { current: '', next: '', confirm: '' };
  showPw = false;
  savingPw = signal(false);

  confirmDeactivate = false;
  deactivatePassword = '';
  deactivating = signal(false);

  successMsg = signal<string | null>(null);
  errorMsg = signal<string | null>(null);
  private toastTimer?: ReturnType<typeof setTimeout>;

  constructor(public auth: AuthService, private router: Router) {}

  ngOnInit(): void {
       if (!this.auth.isBrowser) return; 
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: '/settings' } });
    }
  }

  get initial(): string {
    return (this.auth.currentUser()?.full_name || 'U').charAt(0).toUpperCase();
  }

  changePassword(): void {
    if (!this.pw.current || !this.pw.next || !this.pw.confirm) {
      return this.flash('error', 'Please fill in all password fields.');
    }
    if (this.pw.next.length < 8) {
      return this.flash('error', 'New password must be at least 8 characters.');
    }
    if (this.pw.next !== this.pw.confirm) {
      return this.flash('error', 'New passwords do not match.');
    }
    if (this.pw.next === this.pw.current) {
      return this.flash('error', 'New password must be different from the current one.');
    }

    this.savingPw.set(true);
    this.auth.changePassword({ current_password: this.pw.current, new_password: this.pw.next }).subscribe({
      next: (res) => {
        this.savingPw.set(false);
        this.pw = { current: '', next: '', confirm: '' };
        this.flash('success', res.message || 'Password changed.');
      },
      error: (err) => {
        this.savingPw.set(false);
        this.flash('error', err?.error?.message || 'Could not change password.');
      },
    });
  }

  deactivate(): void {
    if (!this.deactivatePassword) {
      return this.flash('error', 'Please enter your password to confirm.');
    }
    this.deactivating.set(true);
    this.auth.deactivateAccount(this.deactivatePassword).subscribe({
      next: () => {
        this.deactivating.set(false);
        this.router.navigate(['/home']);
      },
      error: (err) => {
        this.deactivating.set(false);
        this.flash('error', err?.error?.message || 'Could not deactivate account.');
      },
    });
  }

  cancelDeactivate(): void {
    this.confirmDeactivate = false;
    this.deactivatePassword = '';
  }

  private flash(type: 'success' | 'error', msg: string): void {
    this.successMsg.set(type === 'success' ? msg : null);
    this.errorMsg.set(type === 'error' ? msg : null);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.successMsg.set(null);
      this.errorMsg.set(null);
    }, 4000);
  }
}