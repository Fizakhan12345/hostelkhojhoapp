import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';


@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.html',
  styleUrls: ['./profile.css'],
})
export class Profile implements OnInit {
  loading = signal(true);
  saving = signal(false);
  uploadingPic = signal(false);
  errorMsg = signal<string | null>(null);
  successMsg = signal<string | null>(null);

  editing = false;

  genderOptions = [
    { value: '', label: 'Not set' },
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
    { value: 'other', label: 'Other' },
  ];

  form = {
    full_name: '',
    phone: '',
    gender: '',
  };

  private toastTimer?: ReturnType<typeof setTimeout>;

  constructor(public auth: AuthService, private router: Router) {}

  ngOnInit(): void {
       if (!this.auth.isBrowser) return; 
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: '/profile' } });
      return;
    }

    this.auth.fetchMe().subscribe({
      next: (res:any) => {
        this.applyUserToForm(res.user);
        this.loading.set(false);
      },
      error: () => {
        this.flashError('Could not load your profile.');
        this.loading.set(false);
      },
    });
  }

  private applyUserToForm(user: any): void {
    this.form.full_name = user.full_name || '';
    this.form.phone = user.phone || '';
    this.form.gender = user.gender || '';
  }

  private flashSuccess(msg: string): void {
    this.errorMsg.set(null);
    this.successMsg.set(msg);
    this.restartToastTimer();
  }
  private flashError(msg: string): void {
    this.successMsg.set(null);
    this.errorMsg.set(msg);
    this.restartToastTimer();
  }
  private restartToastTimer(): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.successMsg.set(null);
      this.errorMsg.set(null);
    }, 4000);
  }

  startEditing(): void {
    this.editing = true;
  }

  cancelEditing(): void {
    const user = this.auth.currentUser();
    if (user) this.applyUserToForm(user);
    this.editing = false;
  }

  selectGender(value: string): void {
    this.form.gender = value;
  }

  saveProfile(): void {
    this.saving.set(true);

    this.auth.updateProfile(this.form).subscribe({
      next: () => {
        this.saving.set(false);
        this.editing = false;
        this.flashSuccess('Profile updated!');
      },
      error: (err:any) => {
        this.saving.set(false);
        this.flashError(err?.error?.message || 'Could not save changes.');
      },
    });
  }

  onPictureSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      this.flashError('Image must be under 5MB.');
      return;
    }

    this.uploadingPic.set(true);

    this.auth.uploadProfilePicture(file).subscribe({
      next: () => {
        this.uploadingPic.set(false);
        this.flashSuccess('Profile picture updated!');
      },
      error: (err:any) => {
        this.uploadingPic.set(false);
        this.flashError(err?.error?.message || 'Could not upload image.');
      },
    });

    input.value = '';
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}