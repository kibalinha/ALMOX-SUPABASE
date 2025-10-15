import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed top-5 right-5 z-50 space-y-2">
      @for(toast of toastService.toasts(); track toast.id) {
        <div 
          class="flex items-center justify-between p-4 rounded-lg shadow-lg max-w-sm text-white transition-all duration-300"
          [class.bg-green-500]="toast.type === 'success'"
          [class.bg-red-500]="toast.type === 'error'"
          [class.bg-blue-500]="toast.type === 'info'"
          [class.opacity-100]="toast.state === 'entering' || toast.state === 'visible'"
          [class.translate-x-0]="toast.state === 'entering' || toast.state === 'visible'"
          [class.opacity-0]="toast.state === 'leaving'"
          [class.translate-x-full]="toast.state === 'leaving'"
          style="transform: translateX(200%);"
        >
          <span>{{ toast.message }}</span>
          <button (click)="toastService.removeToast(toast.id)" class="ml-4 text-xl font-bold">&times;</button>
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-visible {
      transform: translateX(0) !important;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToastContainerComponent {
  toastService = inject(ToastService);

  constructor() {
    // A small hack to force the browser to apply the initial transform before transitioning
    // This makes the slide-in animation work correctly on initial render.
    setTimeout(() => {
        const toasts = document.querySelectorAll('.transition-all');
        toasts.forEach(toast => {
            (toast as HTMLElement).style.transform = 'translateX(0)';
        });
    }, 50);
  }
}