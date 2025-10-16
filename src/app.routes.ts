import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard.ts';
import { adminGuard } from './guards/admin.guard.ts';

export const APP_ROUTES: Routes = [
  { 
    path: 'login', 
    title: 'Login', 
    loadComponent: () => import('./components/login.component.ts').then(c => c.LoginComponent) 
  },
  {
    path: '',
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { 
        path: 'dashboard', 
        title: 'Dashboard', 
        loadComponent: () => import('./components/dashboard.component.ts').then(c => c.DashboardComponent) 
      },
      { 
        path: 'inventory', 
        title: 'Inventário', 
        // FIX: The component file is located in the `components` directory, consistent with other routes.
        // FIX: Added .ts extension to the import path to resolve the module loading error.
        loadComponent: () => import('./components/inventory.component.ts').then(c => c.InventoryComponent) 
      },
      { 
        path: 'red_shelf', 
        title: 'Prateleira Vermelha', 
        loadComponent: () => import('./components/red-shelf.component.ts').then(c => c.RedShelfComponent) 
      },
      { 
        path: 'entry', 
        title: 'Entrada de Itens', 
        data: { movementType: 'in' },
        loadComponent: () => import('./components/movements.component.ts').then(c => c.MovementsComponent) 
      },
      { 
        path: 'exit', 
        title: 'Saída de Itens', 
        data: { movementType: 'out' },
        loadComponent: () => import('./components/movements.component.ts').then(c => c.MovementsComponent) 
      },
      { 
        path: 'purchase_orders', 
        title: 'Ordens de Compra', 
        loadComponent: () => import('./components/purchase-orders.component.ts').then(c => c.PurchaseOrdersComponent) 
      },
      { 
        path: 'picking_lists', 
        title: 'Listas de Coleta', 
        loadComponent: () => import('./components/picking-lists.component.ts').then(c => c.PickingListsComponent) 
      },
      { 
        path: 'cycle_count', 
        title: 'Contagem Cíclica', 
        loadComponent: () => import('./components/cycle-count.component.ts').then(c => c.CycleCountComponent) 
      },
      { 
        path: 'stocktake', 
        title: 'Inventário Físico', 
        loadComponent: () => import('./components/stocktake.component.ts').then(c => c.StocktakeComponent) 
      },
      { 
        path: 'purchase_suggestion', 
        title: 'Sugestão de Compra', 
        loadComponent: () => import('./components/purchase-suggestion.component.ts').then(c => c.PurchaseSuggestionComponent) 
      },
      { 
        path: 'technicians', 
        title: 'Técnicos', 
        data: { type: 'technicians' },
        loadComponent: () => import('./components/management.component.ts').then(c => c.ManagementComponent) 
      },
      { 
        path: 'suppliers', 
        title: 'Fornecedores', 
        data: { type: 'suppliers' },
        loadComponent: () => import('./components/management.component.ts').then(c => c.ManagementComponent) 
      },
      { 
        path: 'reports', 
        title: 'Relatórios', 
        loadComponent: () => import('./components/reports.component.ts').then(c => c.ReportsComponent) 
      },
      { 
        path: 'smart_alerts', 
        title: 'Alertas Inteligentes', 
        loadComponent: () => import('./components/smart-alerts.component.ts').then(c => c.SmartAlertsComponent) 
      },
      { 
        path: 'demand_estimation', 
        title: 'Estimar Demanda', 
        loadComponent: () => import('./components/demand-estimation.component.ts').then(c => c.DemandEstimationComponent) 
      },
      { 
        path: 'audit_log', 
        title: 'Log de Auditoria', 
        loadComponent: () => import('./components/audit-log.component.ts').then(c => c.AuditLogComponent) 
      },
      { 
        path: 'settings', 
        title: 'Configurações',
        canActivate: [adminGuard],
        loadComponent: () => import('./components/settings.component.ts').then(c => c.SettingsComponent) 
      },
       { 
        path: 'users', 
        title: 'Gerenciar Usuários',
        canActivate: [adminGuard],
        loadComponent: () => import('./components/users.component.ts').then(c => c.UsersComponent) 
      },
      { 
        path: 'kiosk', 
        title: 'Kiosk', 
        loadComponent: () => import('./components/kiosk.component.ts').then(c => c.KioskComponent) 
      },
      { 
        path: 'item_lifecycle', 
        title: 'Ciclo de Vida', 
        loadComponent: () => import('./components/item-lifecycle.component.ts').then(c => c.ItemLifecycleComponent) 
      },
       { 
        path: 'kits', 
        title: 'Kits', 
        loadComponent: () => import('./components/kits.component.ts').then(c => c.KitsComponent) 
      },
      { 
        path: 'reservations', 
        title: 'Reservas', 
        loadComponent: () => import('./components/reservations.component.ts').then(c => c.ReservationsComponent) 
      },
      { path: '**', redirectTo: 'dashboard' }
    ]
  }
];