import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
// FIX: Corrected import paths to be relative to the src directory.
import { View } from './models';
import { SidebarComponent } from './components/sidebar.component';
import { ToastContainerComponent } from './components/toast-container.component';
import { ChatbotComponent } from './components/chatbot.component';
import { CommandPaletteComponent, Command } from './components/command-palette.component';
import { GeminiService } from './services/gemini.service';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    SidebarComponent,
    ToastContainerComponent,
    ChatbotComponent,
    CommandPaletteComponent,
  ],
  template: `
@if (isAuthenticated()) {
  <div class="h-screen w-screen flex bg-slate-100 dark:bg-gradient-to-br dark:from-slate-900 dark:to-slate-700 overflow-hidden">
    <!-- Sidebar Container -->
    <div 
      class="fixed inset-y-0 left-0 z-40 w-64 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0"
      [class.-translate-x-full]="!isSidebarOpen()"
    >
      <app-sidebar [currentView]="currentView()" (navigate)="changeView($event)" />
    </div>

    <!-- Main Content Area -->
    <div class="flex-1 flex flex-col overflow-hidden">
      
      <!-- Mobile Header -->
      <header class="md:hidden flex items-center justify-between bg-white dark:bg-primary shadow p-4 z-20">
        <button (click)="toggleSidebar()" class="text-slate-500 dark:text-slate-300">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h1 class="text-lg font-bold">{{ currentViewLabel() }}</h1>
        <div class="w-6"></div> <!-- Spacer to balance the title -->
      </header>

      <!-- Content -->
      <main class="flex-1 overflow-y-auto">
        <router-outlet></router-outlet>
      </main>
    </div>

    <!-- Overlay for mobile sidebar -->
    @if(isSidebarOpen()) {
      <div (click)="closeSidebar()" class="md:hidden fixed inset-0 bg-black bg-opacity-50 z-30"></div>
    }
    
    <app-chatbot (navigateTo)="changeView($event)" />
    @if(isCommandPaletteOpen()) {
      <app-command-palette 
        (close)="closeCommandPalette()" 
        (command)="handleCommand($event)"
      />
    }
  </div>
} @else {
  <router-outlet></router-outlet>
}

<app-toast-container />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.control.k)': 'toggleCommandPalette($event)',
    '(document:keydown.meta.k)': 'toggleCommandPalette($event)',
  }
})
export class AppComponent implements OnInit {
  // FIX: Moved service injection to class property initializers.
  private router = inject(Router);
  private geminiService = inject(GeminiService);
  authService = inject(AuthService);

  currentView = signal<View>('dashboard');
  isCommandPaletteOpen = signal(false);
  isSidebarOpen = signal(false);

  isAuthenticated = computed(() => this.authService.isAuthenticated());

  // Mapeia o ID da view para um rótulo amigável
  private viewLabels: Record<View, string> = {
    dashboard: 'Dashboard',
    inventory: 'Inventário',
    red_shelf: 'Prateleira Vermelha',
    entry: 'Entrada de Itens',
    exit: 'Saída de Itens',
    technicians: 'Técnicos',
    suppliers: 'Fornecedores',
    reports: 'Relatórios',
    audit_log: 'Log de Auditoria',
    settings: 'Configurações',
    demand_estimation: 'Estimar Demanda',
    kiosk: 'Modo Kiosk',
    smart_alerts: 'Alertas Inteligentes',
    cycle_count: 'Contagem Cíclica',
    item_lifecycle: 'Ciclo de Vida do Item',
    purchase_orders: 'Ordens de Compra',
    stocktake: 'Inventário Físico',
    purchase_suggestion: 'Sugestão de Compra',
    picking_lists: 'Listas de Coleta',
    kits: 'Kits',
    reservations: 'Reservas',
    users: 'Gerenciar Usuários'
  };

  currentViewLabel = computed(() => this.viewLabels[this.currentView()] || 'Dashboard');

  constructor() {
  }

  ngOnInit() {
    this.geminiService.validateKeyOnLoad();
    
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      // Extrai o nome da view da URL, removendo a barra inicial
      const view = event.urlAfterRedirects.split('/')[1] as View;
      if (this.viewLabels[view]) {
        this.currentView.set(view);
      } else if (event.urlAfterRedirects !== '/login') {
        this.currentView.set('dashboard'); // Fallback para dashboard
      }
    });
  }

  changeView(view: View) {
    this.router.navigate([view]);
    this.closeSidebar();
  }
  
  toggleSidebar() {
    this.isSidebarOpen.update(v => !v);
  }

  closeSidebar() {
    this.isSidebarOpen.set(false);
  }

  toggleCommandPalette(event: KeyboardEvent) {
    event.preventDefault();
    this.isCommandPaletteOpen.update(v => !v);
  }
  
  closeCommandPalette() {
    this.isCommandPaletteOpen.set(false);
  }

  handleCommand(command: Command) {
    if (command.view) {
      this.changeView(command.view);
      this.closeCommandPalette();
    }
  }
}