import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';


@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrls: ['./register.css']
})
export class Register {
  fullName: string = '';
  email: string = '';
  phone: string = '';
  password: string = '';
  confirmPassword: string = '';
  agreeTerms: boolean = false;
  showPassword: boolean = false;

  loading: boolean = false;
  successMsg: string = '';
  errorMsg: string = '';

  perks = [
    { icon: '🎉', title: 'Free to join', desc: 'Create an account in under a minute, no fees.' },
    { icon: '🔒', title: 'Secure bookings', desc: 'Your payments and data are always protected.' },
    { icon: '📍', title: 'Save your favorites', desc: 'Shortlist hostels and PGs as you browse.' }
  ];

  constructor(
    private router: Router,
    private auth: AuthService
  ) {}

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  onSubmit(): void {
    this.errorMsg = '';

    if (this.password !== this.confirmPassword) {
      this.errorMsg = 'Passwords do not match.';
      return;
    }
    if (this.password.length < 8) {
      this.errorMsg = 'Password must be at least 8 characters.';
      return;
    }
    if (!this.agreeTerms) {
      this.errorMsg = 'Please agree to the Terms and Privacy Policy.';
      return;
    }

    this.loading = true;

    this.auth.register({
      full_name: this.fullName,
      email: this.email,
      phone: this.phone,
      password: this.password,
    }).subscribe({
      next: () => {
        this.loading = false;
        this.successMsg = 'Account created! Redirecting…';

        setTimeout(() => {
          this.router.navigate(['/profile']);
        }, 800);
      },
      error: (err: { error: { message: string } }) => {
        this.loading = false;
        this.errorMsg = err?.error?.message || 'Registration failed. Please try again.';
      },
    });
  }
}