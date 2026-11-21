// admin-auth.component.ts  →  route: /register-your-hostel
// Property OWNER login + sign-up. (Class name kept so app.routes.ts doesn't change.)
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ADMIN_DASHBOARD_ROUTE, AdminAuthService } from '../../core/services/admin-auth.service';

type Tab = 'login' | 'signup';

@Component({
  selector: 'app-admin-auth',
  templateUrl: './admin-auth.component.html',
  standalone: true,
  imports: [FormsModule, CommonModule, RouterLink],
  styleUrls: ['./admin-auth.component.css'],
})
export class AdminAuthComponent implements OnInit {
  activeTab: Tab = 'signup';
  showPassword = false;
  loading = false;
  error = '';

  loginForm = { email: '', password: '', remember: true };

  signupForm = {
    full_name: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
    agreed: false,
  };

  /** Windows of the building on the left. The 5 marked `free` are the 5 free listings. */
  readonly windows = Array.from({ length: 48 }, (_, i) => ({
    free: [15, 20, 26, 33, 38].includes(i),
    lit: (i * 7 + 3) % 11 < 3, // fixed pattern, same on server and browser
    order: [15, 20, 26, 33, 38].indexOf(i),
  }));

  readonly promises = [
    { title: '5 listings free', text: 'No card needed. Upgrade only when you grow.' },
    { title: 'Tenants call you directly', text: 'Every enquiry lands in your dashboard and inbox.' },
    { title: 'Show what makes you different', text: 'Meals, WiFi speed, gate timings, house rules.' },
  ];

  constructor(private router: Router, private route: ActivatedRoute, private auth: AdminAuthService) {}

  ngOnInit(): void {
    const tab = this.route.snapshot.queryParamMap.get('tab');
    if (tab === 'login' || tab === 'signup') this.activeTab = tab;

    // Already logged in as an owner → straight to the dashboard
    if (this.auth.isBrowser && this.auth.isLoggedIn()) {
      this.router.navigate([ADMIN_DASHBOARD_ROUTE]);
    }
  }

  switchTab(tab: Tab): void {
    this.activeTab = tab;
    this.error = '';
  }

  onLogin(): void {
    this.error = '';
    if (!this.loginForm.email || !this.loginForm.password) {
      this.error = 'Enter your email and password.';
      return;
    }
    this.loading = true;
    this.auth.login(this.loginForm.email.trim(), this.loginForm.password, this.loginForm.remember).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate([ADMIN_DASHBOARD_ROUTE]);
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'Email or password is incorrect.';
      },
    });
  }

  onSignup(): void {
    this.error = '';
    const f = this.signupForm;
    if (!f.full_name.trim() || !f.phone.trim() || !f.email.trim() || !f.password) {
      this.error = 'Fill in your name, phone, email and a password.';
      return;
    }
    if (f.password.length < 8) {
      this.error = 'Use at least 8 characters for your password.';
      return;
    }
    if (f.password !== f.confirmPassword) {
      this.error = 'The two passwords don’t match.';
      return;
    }
    if (!f.agreed) {
      this.error = 'Accept the terms to create your account.';
      return;
    }

    this.loading = true;
    this.auth
      .register({ full_name: f.full_name.trim(), phone: f.phone.trim(), email: f.email.trim(), password: f.password })
      .subscribe({
        next: () => {
          this.loading = false;
          this.router.navigate([ADMIN_DASHBOARD_ROUTE], { queryParams: { welcome: 1 } });
        },
        error: (err) => {
          this.loading = false;
          this.error = err?.error?.message || 'Could not create your account. Try again.';
        },
      });
  }
}
