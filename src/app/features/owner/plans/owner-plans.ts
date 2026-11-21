// features/owner/plans/owner-plans.ts  →  /owner/plans
// Two ways to pay:
//   1. UPI direct to your UPI ID (no gateway fees) → owner enters UTR → you confirm in super admin
//   2. Razorpay checkout (instant, ~2% + GST fee) — only shown when its keys are set
import { CommonModule } from '@angular/common';
import { Component, NgZone, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ADMIN_LOGIN_ROUTE, AdminAuthService } from '../../../core/services/admin-auth.service';
import { OwnerMe, OwnerMeta, OwnerPlan, OwnerService, UpiIntent } from '../../../core/services/owner.service';

declare global {
  interface Window {
    Razorpay?: any;
  }
}

const PLAN_POINTS: Record<string, string[]> = {
  free: ['Up to 5 listings', 'Contact details for your first 5 enquiries', 'Photos, food, facilities and rules on every listing'],
  pro: ['Up to 25 listings', 'Contact details for every enquiry', 'Everything in Starter'],
  business: ['Unlimited listings', 'Contact details for every enquiry', 'For hostel chains and property managers'],
};

@Component({
  selector: 'app-owner-plans',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styleUrls: ['../shared/owner-theme.css'],
  template: `
    <h1>Plan &amp; billing</h1>
    <p class="lead" *ngIf="me() as m">
      You’re on <strong>{{ m.plan.name }}</strong> — {{ m.usage.listings }} of {{ m.usage.limit >= 1000 ? 'unlimited' : m.usage.limit }} listings used<ng-container *ngIf="m.plan.ends_at">, active until {{ m.plan.ends_at | date:'d MMM y' }}</ng-container>.
    </p>

    <p class="notice ok" *ngIf="success()">{{ success() }}</p>
    <p class="notice error" *ngIf="error()">{{ error() }}</p>
    <p class="notice warn" *ngIf="pending() as p">
      Your {{ planName(p.plan_code) }} payment (UTR {{ p.razorpay_payment_id }}) is waiting for confirmation.
      We’ll activate it as soon as it shows in our account — usually within a few hours.
    </p>
    <p class="notice warn" *ngIf="meta() && !meta()!.upiConfigured && !meta()!.razorpayConfigured">
      Upgrades aren’t available yet. Please check back soon.
    </p>

    <ng-container *ngIf="loading()"><div class="skeleton" style="height: 280px"></div></ng-container>

    <div class="plans" *ngIf="!loading() && meta() as meta">
      <article class="plan surface" *ngFor="let p of meta.plans" [class.current]="me()?.plan?.code === p.code" [class.featured]="p.code === 'pro'">
        <h2>{{ p.name }}</h2>
        <p class="price">
          <ng-container *ngIf="p.price === 0">Free</ng-container>
          <ng-container *ngIf="p.price > 0">₹{{ p.price | number }}<span>/month</span></ng-container>
        </p>
        <ul>
          <li *ngFor="let line of points(p)">{{ line }}</li>
        </ul>

        <span class="tag ok" *ngIf="me()?.plan?.code === p.code">Your current plan</span>

        <ng-container *ngIf="p.price > 0">
          <button type="button" class="btn"
                  *ngIf="meta.upiConfigured"
                  [class.btn-main]="p.code === 'pro'" [class.btn-dark]="p.code !== 'pro'"
                  [disabled]="!!pending() || busy() !== null"
                  (click)="openUpi(p)">
            {{ busy() === 'upi-' + p.code ? 'Loading…' : (me()?.plan?.code === p.code ? 'Renew by UPI' : 'Pay ₹' + p.price + ' by UPI') }}
          </button>
          <button type="button" class="btn btn-ghost"
                  *ngIf="meta.razorpayConfigured"
                  [disabled]="busy() !== null"
                  (click)="buy(p)">
            {{ busy() === 'rzp-' + p.code ? 'Opening payment…' : 'Pay by card / net banking' }}
          </button>
        </ng-container>
      </article>
    </div>

    <p class="fine">
      UPI payments go straight to our bank account with no extra charges — pay from any UPI app, then enter the 12-digit UTR.
      Paid plans run for 30 days and don’t renew automatically.
    </p>

    <section class="history" *ngIf="history().length">
      <h2>Payment history</h2>
      <div class="surface">
        <div class="hrow" *ngFor="let h of history()">
          <span>{{ planName(h.plan_code) }}</span>
          <span>₹{{ h.amount_paise / 100 | number }}</span>
          <span *ngIf="h.status === 'paid'">{{ h.starts_at | date:'d MMM y' }} – {{ h.ends_at | date:'d MMM y' }}</span>
          <span *ngIf="h.status === 'pending'" class="st wait">Waiting for confirmation</span>
          <span *ngIf="h.status === 'rejected'" class="st bad">Not received — contact support</span>
          <span class="pid">{{ h.method === 'upi' ? 'UPI ' : '' }}{{ h.razorpay_payment_id }}</span>
        </div>
      </div>
    </section>

    <!-- ══════════ UPI payment panel ══════════ -->
    <ng-container *ngIf="upi() as u">
      <div class="overlay" (click)="closeUpi()"></div>
      <aside class="upi-panel" role="dialog" aria-label="Pay by UPI">
        <div class="upi-head">
          <h2>Pay ₹{{ u.amount | number }} by UPI</h2>
          <button type="button" class="close" (click)="closeUpi()" aria-label="Close">×</button>
        </div>

        <ol class="steps">
          <li>
            <strong>Scan and pay ₹{{ u.amount | number }}</strong>
            <div class="qr" *ngIf="u.qr"><img [src]="u.qr" alt="UPI QR code to pay HostelKhojo" /></div>
            <p class="small">Or pay to this UPI ID from Google Pay, PhonePe, Paytm or your bank app:</p>
            <div class="upi-id">
              <code>{{ u.upi_id }}</code>
              <button type="button" class="btn btn-ghost" (click)="copy(u.upi_id)">{{ copied() ? 'Copied' : 'Copy' }}</button>
            </div>
            <a class="btn btn-ghost app-btn" [href]="u.link">Open UPI app on this phone</a>
            <p class="small">Add <strong>{{ u.note }}</strong> as the payment note so we can match it to your account.</p>
          </li>
          <li>
            <strong>Enter the UTR from your payment app</strong>
            <p class="small">It’s the 12-digit number shown after the payment, sometimes called UPI reference or transaction ID.</p>
            <form (ngSubmit)="submitUtr(u)" class="utr-form">
              <input type="text" inputmode="numeric" maxlength="14" [(ngModel)]="utr" name="utr"
                     placeholder="e.g. 431256789012" autocomplete="off" aria-label="UTR number" />
              <p class="notice error" *ngIf="upiError()">{{ upiError() }}</p>
              <button type="submit" class="btn btn-main" [disabled]="claiming()">
                {{ claiming() ? 'Submitting…' : 'I’ve paid — submit UTR' }}
              </button>
            </form>
          </li>
        </ol>
        <p class="small muted">Your {{ u.plan.name }} plan starts once the payment reaches our account, usually within a few hours.</p>
      </aside>
    </ng-container>
  `,
  styles: [`
    .plans { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-top: 1.75rem; }
    .plan { display: flex; flex-direction: column; gap: 0.9rem; padding: 1.6rem; }
    .plan.featured { border: 2px solid var(--saffron); }
    .plan.current { background: linear-gradient(180deg, #FFFBF2, #fff); }
    .plan h2 { margin: 0; }
    .price { margin: 0; font-family: 'Bricolage Grotesque', sans-serif; font-weight: 800; font-size: 2.2rem; color: var(--ink); letter-spacing: -0.02em; }
    .price span { font-size: 0.95rem; font-weight: 500; color: var(--muted); font-family: 'Plus Jakarta Sans', sans-serif; letter-spacing: 0; }
    ul { margin: 0; padding-left: 1.1rem; display: grid; gap: 0.45rem; color: var(--ink); line-height: 1.45; flex: 1; }
    .plan .tag { align-self: flex-start; }
    .plan .btn:first-of-type { margin-top: auto; }
    .fine { margin: 1.25rem 0 0; color: var(--muted); font-size: 0.88rem; max-width: 70ch; line-height: 1.5; }
    .history { margin-top: 2.5rem; }
    .hrow { display: grid; grid-template-columns: 1fr 0.7fr 1.4fr 1.4fr; gap: 1rem; padding: 0.7rem 0; border-bottom: 1px solid var(--line); font-size: 0.92rem; align-items: center; }
    .hrow:last-child { border-bottom: none; }
    .pid { color: var(--muted); font-size: 0.82rem; word-break: break-all; }
    .st { font-weight: 600; }
    .st.wait { color: var(--warn); }
    .st.bad { color: var(--danger); }

    .overlay { position: fixed; inset: 0; background: rgba(18, 20, 43, 0.55); z-index: 1100; }
    .upi-panel {
      position: fixed; top: 0; right: 0; bottom: 0; width: 460px; max-width: 100vw; z-index: 1101;
      background: #fff; overflow-y: auto; padding: 1.5rem 1.6rem 2rem;
      box-shadow: -10px 0 40px rgba(18, 20, 43, 0.25);
    }
    .upi-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
    .upi-head h2 { margin: 0; }
    .close { width: 36px; height: 36px; border: none; border-radius: 8px; background: #EEEFF6; font-size: 1.3rem; cursor: pointer; }
    .steps { margin: 0; padding-left: 1.2rem; display: grid; gap: 1.5rem; }
    .steps li::marker { font-weight: 800; color: var(--saffron); }
    .steps strong { display: block; margin-bottom: .6rem; }
    .qr { width: 220px; padding: 10px; border: 1px solid var(--line); border-radius: 12px; margin-bottom: .6rem; }
    .qr img { display: block; width: 100%; }
    .small { margin: .4rem 0; font-size: .88rem; color: var(--muted); line-height: 1.5; }
    .small strong { display: inline; margin: 0; color: var(--ink); }
    .muted { margin-top: 1.5rem; }
    .upi-id { display: flex; gap: .5rem; align-items: center; }
    .upi-id code { flex: 1; padding: .65rem .8rem; border-radius: 8px; background: #F3F4FA; font-size: .95rem; font-weight: 700; color: var(--ink); word-break: break-all; }
    .app-btn { margin-top: .6rem; width: 100%; }
    .utr-form { display: grid; gap: .6rem; }
    .utr-form input {
      padding: .8rem .9rem; border: 1.5px solid var(--line); border-radius: 10px;
      font: inherit; font-size: 1.05rem; letter-spacing: .08em; outline: none;
    }
    .utr-form input:focus { border-color: var(--dusk); box-shadow: 0 0 0 3px rgba(35, 39, 94, 0.12); }
    .utr-form .notice { margin: 0; }

    @media (max-width: 860px) {
      .plans { grid-template-columns: 1fr; }
      .hrow { grid-template-columns: 1fr 1fr; }
    }
  `],
})
export class OwnerPlans implements OnInit {
  private owner = inject(OwnerService);
  private auth = inject(AdminAuthService);
  private router = inject(Router);
  private zone = inject(NgZone);

  loading = signal(true);
  error = signal<string | null>(null);
  success = signal<string | null>(null);
  busy = signal<string | null>(null);
  me = signal<OwnerMe | null>(null);
  meta = signal<OwnerMeta | null>(null);
  history = signal<any[]>([]);

  pending = computed(() => this.history().find((h) => h.status === 'pending') || null);

  // UPI panel
  upi = signal<UpiIntent | null>(null);
  utr = '';
  claiming = signal(false);
  upiError = signal<string | null>(null);
  copied = signal(false);

  ngOnInit(): void {
    if (this.auth.isBrowser) this.load();
  }

  load(): void {
    this.loading.set(true);
    forkJoin({ me: this.owner.me(), meta: this.owner.meta(), history: this.owner.subscriptions() }).subscribe({
      next: ({ me, meta, history }) => {
        this.me.set(me);
        this.meta.set(meta);
        this.history.set(history);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        if (err?.status === 401 || err?.status === 403) {
          this.auth.logout();
          this.router.navigate([ADMIN_LOGIN_ROUTE], { queryParams: { tab: 'login' } });
          return;
        }
        this.error.set(err?.error?.message || 'Could not load plans.');
      },
    });
  }

  points(p: OwnerPlan): string[] {
    const base = PLAN_POINTS[p.code] || [];
    return p.code === 'free' ? [`Up to ${p.listings} listings`, ...base.slice(1)] : base;
  }

  planName(code: string): string {
    return this.meta()?.plans.find((p) => p.code === code)?.name || code;
  }

  // ── UPI ─────────────────────────────────────────────────
  openUpi(plan: OwnerPlan): void {
    this.error.set(null);
    this.success.set(null);
    this.upiError.set(null);
    this.utr = '';
    this.busy.set('upi-' + plan.code);
    this.owner.upiIntent(plan.code).subscribe({
      next: (intent) => {
        this.busy.set(null);
        this.upi.set(intent);
      },
      error: (err) => {
        this.busy.set(null);
        this.error.set(err?.error?.message || 'Could not load UPI details.');
      },
    });
  }

  closeUpi(): void {
    if (!this.claiming()) this.upi.set(null);
  }

  copy(text: string): void {
    navigator.clipboard?.writeText(text).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    });
  }

  submitUtr(intent: UpiIntent): void {
    const utr = this.utr.replace(/\s+/g, '');
    if (!/^\d{12}$/.test(utr)) {
      this.upiError.set('The UTR is the 12-digit number in your UPI app’s payment details.');
      return;
    }
    this.claiming.set(true);
    this.upiError.set(null);
    this.owner.upiClaim(intent.plan.code, utr).subscribe({
      next: (res) => {
        this.claiming.set(false);
        this.upi.set(null);
        this.success.set(res.message || 'Payment submitted. We’ll activate your plan once it’s confirmed.');
        this.load();
      },
      error: (err) => {
        this.claiming.set(false);
        this.upiError.set(err?.error?.message || 'Could not submit. Check the UTR and try again.');
      },
    });
  }

  // ── Razorpay (optional, instant) ───────────────────────
  private loadRazorpay(): Promise<void> {
    if (window.Razorpay) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://checkout.razorpay.com/v1/checkout.js';
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Could not load the card payment window. Check your internet connection.'));
      document.body.appendChild(s);
    });
  }

  async buy(plan: OwnerPlan): Promise<void> {
    this.error.set(null);
    this.success.set(null);
    this.busy.set('rzp-' + plan.code);

    try {
      await this.loadRazorpay();
    } catch (e: any) {
      this.busy.set(null);
      this.error.set(e.message);
      return;
    }

    this.owner.createOrder(plan.code).subscribe({
      next: (order) => {
        const rzp = new window.Razorpay({
          key: order.key_id,
          amount: order.amount,
          currency: order.currency,
          order_id: order.order_id,
          name: 'HostelKhojo',
          description: `${order.plan.name} plan · 30 days`,
          prefill: order.prefill,
          theme: { color: '#FF7A00' },
          handler: (resp: any) => this.zone.run(() => this.verify(resp, plan)),
          modal: { ondismiss: () => this.zone.run(() => this.busy.set(null)) },
        });
        rzp.on('payment.failed', (resp: any) =>
          this.zone.run(() => {
            this.busy.set(null);
            this.error.set(resp?.error?.description || 'Payment failed. No money was taken — try again.');
          })
        );
        rzp.open();
      },
      error: (err) => {
        this.busy.set(null);
        this.error.set(err?.error?.message || 'Could not start the payment.');
      },
    });
  }

  private verify(resp: any, plan: OwnerPlan): void {
    this.owner
      .verifyPayment({
        razorpay_order_id: resp.razorpay_order_id,
        razorpay_payment_id: resp.razorpay_payment_id,
        razorpay_signature: resp.razorpay_signature,
      })
      .subscribe({
        next: () => {
          this.busy.set(null);
          this.success.set(`Payment received. ${plan.name} is active.`);
          this.load();
        },
        error: (err) => {
          this.busy.set(null);
          this.error.set(
            (err?.error?.message || 'We couldn’t confirm the payment.') +
              ` If money was deducted, contact support with payment ID ${resp.razorpay_payment_id}.`
          );
        },
      });
  }
}
