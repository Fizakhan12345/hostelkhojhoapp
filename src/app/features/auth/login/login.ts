import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';


@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class Login {
  email: string = '';
  password: string = '';
  rememberMe: boolean = false;
  showPassword: boolean = false;

  loading: boolean = false;
  successMsg: string = '';
  errorMsg: string = '';

  perks = [
    { icon: '✅', title: 'Verified Listings', desc: 'Every hostel and PG is checked before it goes live.' },
    { icon: '💬', title: 'Direct Messaging', desc: 'Talk to owners directly — no brokers, no markup.' },
    { icon: '⭐', title: 'Real Reviews', desc: 'Ratings from tenants who actually stayed there.' }
  ];

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private auth: AuthService
  ) {}

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  onSubmit(): void {
    this.errorMsg = '';

    if (!this.email || !this.password) {
      this.errorMsg = 'Please fill in all fields.';
      return;
    }

    this.loading = true;

    this.auth.login({ email: this.email, password: this.password }).subscribe({
      next: () => {
        this.loading = false;
        this.successMsg = 'Login successful! Redirecting…';

        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');

        setTimeout(() => {
          this.router.navigateByUrl(returnUrl || '/profile');
        }, 800);
      },
      error: (err:any) => {
        this.loading = false;
        this.errorMsg = err?.error?.message || 'Login failed. Please try again.';
      },
    });
  }
}