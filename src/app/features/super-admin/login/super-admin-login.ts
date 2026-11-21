// features/super-admin/login/super-admin-login.ts  →  route: /super-admin/login
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SUPER_ADMIN_HOME_ROUTE, SuperAdminService } from '../../../core/services/super-admin.service';

@Component({
  selector: 'app-super-admin-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="sa-login">
      <div class="card">
        <div class="badge">🛡️ Restricted Area</div>
        <h1>Super Admin</h1>
        <p class="sub">HostelKhojo control panel. Authorised access only.</p>

        <form (ngSubmit)="login()">
          <label>Email</label>
          <input type="email" [(ngModel)]="email" name="email" autocomplete="username" required />

          <label>Password</label>
          <div class="pw">
            <input [type]="show ? 'text' : 'password'" [(ngModel)]="password" name="password"
                   autocomplete="current-password" required />
            <button type="button" (click)="show = !show">{{ show ? 'Hide' : 'Show' }}</button>
          </div>

          <p class="error" *ngIf="error()">⚠️ {{ error() }}</p>

          <button class="submit" type="submit" [disabled]="loading()">
            {{ loading() ? 'Signing in…' : 'Sign in →' }}
          </button>
        </form>
      </div>
    </div>
  `,
  styles: [`
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=DM+Sans:wght@400;500;600&display=swap');
    :host { display: block; font-family: 'DM Sans', sans-serif; }
    .sa-login {
      min-height: 100vh; padding: 96px 1rem 2rem; display: flex; align-items: center; justify-content: center;
      background: linear-gradient(160deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
    }
    .card { width: 100%; max-width: 400px; background: #fff; border-radius: 20px; padding: 2.25rem 2rem; box-shadow: 0 20px 60px rgba(0,0,0,.35); }
    .badge { display: inline-block; font-size: .72rem; font-weight: 700; letter-spacing: .5px; text-transform: uppercase;
             padding: .3rem .7rem; border-radius: 999px; background: #fff9e6; color: #92400e; border: 1px solid #f6c90e; }
    h1 { margin: .9rem 0 .25rem; font-family: 'Sora', sans-serif; font-size: 1.7rem; font-weight: 800; color: #1a1a2e; }
    .sub { margin: 0 0 1.5rem; color: #6b7280; font-size: .88rem; }
    form { display: flex; flex-direction: column; gap: .4rem; }
    label { font-size: .74rem; font-weight: 700; letter-spacing: .4px; text-transform: uppercase; color: #4b5563; margin-top: .5rem; }
    input { width: 100%; padding: .75rem .9rem; border: 1.5px solid #e2e8f0; border-radius: 10px; font: inherit; background: #fafafa; outline: none; box-sizing: border-box; }
    input:focus { border-color: #0f3460; background: #fff; }
    .pw { position: relative; }
    .pw button { position: absolute; right: .5rem; top: 50%; transform: translateY(-50%); border: none; background: none;
                 font: inherit; font-size: .78rem; font-weight: 700; color: #0f3460; cursor: pointer; }
    .error { margin: .6rem 0 0; padding: .7rem .9rem; border-radius: 10px; background: #fef2f2; color: #991b1b; font-size: .85rem; }
    .submit { margin-top: 1.1rem; padding: .85rem; border: none; border-radius: 12px; cursor: pointer;
              background: linear-gradient(135deg, #1a1a2e, #0f3460); color: #f6c90e; font-family: 'Sora', sans-serif; font-weight: 700; font-size: .95rem; }
    .submit:disabled { opacity: .6; cursor: not-allowed; }
  `],
})
export class SuperAdminLogin implements OnInit {
  private sa = inject(SuperAdminService);
  private router = inject(Router);

  email = '';
  password = '';
  show = false;
  loading = signal(false);
  error = signal<string | null>(null);

  ngOnInit(): void {
    if (this.sa.isBrowser && this.sa.isLoggedIn()) this.router.navigate([SUPER_ADMIN_HOME_ROUTE]);
  }

  login(): void {
    if (!this.email || !this.password) {
      this.error.set('Enter your email and password.');
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.sa.login(this.email.trim(), this.password).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate([SUPER_ADMIN_HOME_ROUTE]);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message || 'Could not sign in.');
      },
    });
  }
}
