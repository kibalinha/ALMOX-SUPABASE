import { Component, ChangeDetectionStrategy, inject, computed, signal, input, effect, viewChild, ElementRef, OnDestroy, output, viewChildren, WritableSignal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators, FormControl } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged, tap } from 'rxjs/operators';
import { DatabaseService } from '../services/database.service.ts';
import { ToastService } from '../services/toast.service.ts';
import { GeminiService } from '../services/gemini.service.ts';
import { Item, SearchFilter, Supplier, Movement, ParsedInvoiceItem, View, AlmoxarifadoDB } from '../models.ts';
import { ImageRecognitionComponent } from './image-recognition.component.ts';
import { InvoiceRecognitionComponent } from './invoice-recognition.component.ts';

declare var JsBarcode: any;
declare var html2canvas: any;
declare var jspdf: any;

type ItemForm = Omit<Item, 'id' | 'createdAt'> & { id?: string };
interface AiSuggestion {
  description: string;
  category: string;
  reorderPoint: {
    suggestion: number;
    reasoning: string;
  } | null;
}

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [
    CommonModule, 
    ReactiveFormsModule, 
    CurrencyPipe, 
    DatePipe, 
    ImageRecognitionComponent, 
    InvoiceRecognitionComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-4 sm:p-6 h-full flex flex-col">
      <header class="flex justify-between items-start mb-4 gap-2 flex-wrap">
        <div>
            <h2 class="text-2xl font-bold">Inventário</h2>
            <p class="text-sm text-slate-500 dark:text-slate-400">Gerencie e adicione novos tipos de itens ao seu estoque.</p>
        </div>
        <div class="flex gap-2 flex-wrap">
           @if (selectedItemIds().size > 0) {
            <button (click)="openDeleteMultipleConfirm()" class="bg-error text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors">
              Excluir Selecionados ({{ selectedItemIds().size }})
            </button>
          } @else {
            <button (click)="openPrintAllModal()" class="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors">
              Gerar Todas as Etiquetas
            </button>
            <button (click)="openBatchForm()" class="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors">
              Adicionar em Lote
            </button>
             <button (click)="isImageRecognitionOpen.set(true)" class="bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 transition-colors flex items-center gap-2">
              Item por Foto 📸
            </button>
            <button (click)="isInvoiceRecognitionOpen.set(true)" class="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition-colors flex items-center gap-2">
              Via Nota Fiscal 🧾
            </button>
            <button (click)="openItemForm()" class="bg-accent text-white px-4 py-2 rounded-md hover:bg-info transition-colors">
              + Adicionar Item
            </button>
          }
        </div>
      </header>
      
      <!-- Filters -->
      <div class="bg-slate-50 dark:bg-primary/50 p-3 rounded-lg mb-4 border border-slate-200 dark:border-secondary">
        <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div class="md:col-span-2">
            <label class="block text-sm font-medium mb-1">Busca Rápida ou IA</label>
            <div class="relative w-full">
              <input 
                type="text" 
                placeholder="Busque por nome ou use a IA..." 
                class="bg-white dark:bg-secondary p-2 pr-10 rounded-md border border-slate-300 dark:border-slate-600 focus:border-accent focus:outline-none w-full"
                [formControl]="searchControl"
              />
              @if(isAiSearching()) {
                  <div class="absolute right-3 top-1/2 -translate-y-1/2">
                      <div class="w-5 h-5 border-2 border-slate-400 border-t-accent rounded-full animate-spin"></div>
                  </div>
              }
            </div>
          </div>
          <div [formGroup]="filterForm" class="md:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label class="block text-sm font-medium mb-1">Categoria</label>
              <select formControlName="category" class="w-full bg-white dark:bg-secondary p-2 rounded-md border border-slate-300 dark:border-slate-600">
                <option value="">Todas</option>
                @for (cat of db().categories; track cat) { <option [value]="cat">{{cat}}</option> }
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Fornecedor</label>
              <select formControlName="supplierId" class="w-full bg-white dark:bg-secondary p-2 rounded-md border border-slate-300 dark:border-slate-600">
                <option value="">Todos</option>
                @for (sup of db().suppliers; track sup.id) { <option [value]="sup.id">{{sup.name}}</option> }
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Estoque</label>
              <select formControlName="stockStatus" class="w-full bg-white dark:bg-secondary p-2 rounded-md border border-slate-300 dark:border-slate-600">
                <option value="">Qualquer</option>
                <option value="ok">OK</option>
                <option value="low">Baixo</option>
                <option value="empty">Vazio</option>
              </select>
            </div>
          </div>
        </div>
        @if (aiFilterPills().length > 0) {
          <div class="flex items-center gap-2 mt-2 flex-wrap border-t border-slate-200 dark:border-secondary pt-2">
            <span class="text-sm font-semibold text-slate-600 dark:text-slate-300">Filtros da IA:</span>
            @for (pill of aiFilterPills(); track pill.key) {
              @if(pill.isSeparator) {
                <span class="text-sm font-bold text-slate-500 dark:text-slate-400">{{ pill.label }}</span>
              } @else {
                <span class="bg-sky-100 dark:bg-sky-900 text-sky-800 dark:text-sky-200 text-xs font-medium px-2.5 py-1 rounded-full">
                  {{ pill.label }}
                </span>
              }
            }
            <button (click)="clearAiFilters()" class="text-accent dark:text-sky-400 hover:underline text-sm ml-2">
              Limpar Filtros IA
            </button>
          </div>
        }
      </div>

      <!-- Inventory Content -->
      <div class="flex-grow overflow-auto">
        <!-- Table for Medium and up -->
        <table class="w-full text-left hidden md:table">
          <thead class="sticky top-0 bg-slate-50 dark:bg-secondary">
            <tr class="border-b border-slate-200 dark:border-slate-600">
              <th class="p-3 w-12 text-center">
                <input 
                  type="checkbox" 
                  class="h-4 w-4 rounded text-accent focus:ring-accent"
                  [checked]="isAllOnPageSelected()"
                  (change)="toggleSelectAllOnPage()"
                />
              </th>
              <th class="p-3 cursor-pointer" (click)="handleSort('name')">
                Nome
                @if (sortColumn() === 'name') {
                  <span class="ml-1">{{ sortDirection() === 'asc' ? '▲' : '▼' }}</span>
                }
              </th>
              <th class="p-3 cursor-pointer" (click)="handleSort('category')">
                Categoria
                 @if (sortColumn() === 'category') {
                  <span class="ml-1">{{ sortDirection() === 'asc' ? '▲' : '▼' }}</span>
                }
              </th>
              <th class="p-3 cursor-pointer" (click)="handleSort('quantity')">
                Quantidade
                 @if (sortColumn() === 'quantity') {
                  <span class="ml-1">{{ sortDirection() === 'asc' ? '▲' : '▼' }}</span>
                }
              </th>
              <th class="p-3 cursor-pointer" (click)="handleSort('reorderPoint')">
                Ponto Ressup.
                @if (sortColumn() === 'reorderPoint') {
                  <span class="ml-1">{{ sortDirection() === 'asc' ? '▲' : '▼' }}</span>
                }
              </th>
              <th class="p-3">Fornecedor Pref.</th>
              <th class="p-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            @for(item of paginatedItems(); track item.id) {
              <tr 
                class="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-primary"
                [class.bg-sky-50]="selectedItemIds().has(item.id)" 
                [class.dark:bg-sky-900/20]="selectedItemIds().has(item.id)">
                <td class="p-3 text-center">
                  <input 
                    type="checkbox"
                    class="h-4 w-4 rounded text-accent focus:ring-accent"
                    [checked]="selectedItemIds().has(item.id)"
                    (change)="toggleSelection(item.id)"
                  />
                </td>
                <td class="p-3">{{ item.name }}</td>
                <td class="p-3">{{ item.category }}</td>
                <td class="p-3">
                  <span 
                    [class.text-error]="item.quantity <= item.reorderPoint && item.quantity > 0"
                    [class.text-red-700]="item.quantity === 0">
                    {{ item.quantity }}
                  </span>
                </td>
                <td class="p-3">{{ item.reorderPoint }}</td>
                <td class="p-3">{{ getSupplierName(item.preferredSupplierId) }}</td>
                <td class="p-3 flex items-center space-x-2">
                   <button (click)="viewLifecycle(item)" class="p-1 text-slate-500 dark:text-slate-300 hover:text-accent" title="Ciclo de Vida do Item">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd" /></svg>
                  </button>
                  <button (click)="openAdjustmentModal(item)" class="p-1 text-slate-500 dark:text-slate-300 hover:text-accent" title="Ajustar Estoque">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fill-rule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clip-rule="evenodd" /></svg>
                  </button>
                  <button (click)="openPrintLabelModal(item)" class="p-1 text-slate-500 dark:text-slate-300 hover:text-accent" title="Imprimir Etiqueta">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M1 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1H2a1 1 0 01-1-1V4zM6 3a1 1 0 011 1v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1h1zM11 3a1 1 0 011 1v4a1 1 0 01-2 0V4a1 1 0 011-1zM10 9a1 1 0 011 1v6a1 1 0 01-2 0v-6a1 1 0 011-1zM15 3a1 1 0 011 1v12a1 1 0 01-2 0V4a1 1 0 011-1z"/></svg>
                  </button>
                  <button (click)="openItemForm(item)" class="p-1 text-slate-500 dark:text-slate-300 hover:text-accent" title="Editar Item">✏️</button>
                  <button (click)="openDeleteConfirm(item)" class="p-1 text-slate-500 dark:text-slate-300 hover:text-error" title="Excluir Item">🗑️</button>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="7" class="p-4 text-center text-slate-500 dark:text-slate-400">Nenhum item encontrado.</td>
              </tr>
            }
          </tbody>
        </table>

        <!-- Card List for Mobile -->
        <div class="md:hidden space-y-3">
            @for(item of paginatedItems(); track item.id) {
              <div class="bg-white dark:bg-secondary rounded-lg p-4 shadow flex gap-3 items-start" [class.bg-sky-50]="selectedItemIds().has(item.id)" [class.dark:bg-sky-900/20]="selectedItemIds().has(item.id)">
                 <div>
                    <input 
                      type="checkbox"
                      class="h-5 w-5 rounded text-accent focus:ring-accent mt-1"
                      [checked]="selectedItemIds().has(item.id)"
                      (change)="toggleSelection(item.id)"
                    />
                  </div>
                <div class="flex-grow">
                  <div class="flex justify-between items-start">
                    <div>
                      <p class="font-bold text-slate-800 dark:text-slate-100">{{ item.name }}</p>
                      <p class="text-sm text-slate-500 dark:text-slate-400">{{ item.category }}</p>
                    </div>
                    <div class="flex items-center space-x-2 flex-shrink-0">
                      <button (click)="viewLifecycle(item)" class="p-1 text-slate-500 dark:text-slate-300 hover:text-accent" title="Histórico">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd" /></svg>
                      </button>
                       <button (click)="openPrintLabelModal(item)" class="p-1 text-slate-500 dark:text-slate-300 hover:text-accent" title="Imprimir Etiqueta">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M1 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1H2a1 1 0 01-1-1V4zM6 3a1 1 0 011 1v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1h1zM11 3a1 1 0 011 1v4a1 1 0 01-2 0V4a1 1 0 011-1zM10 9a1 1 0 011 1v6a1 1 0 01-2 0v-6a1 1 0 011-1zM15 3a1 1 0 011 1v12a1 1 0 01-2 0V4a1 1 0 011-1z"/></svg>
                      </button>
                      <button (click)="openItemForm(item)" class="p-1 text-slate-500 dark:text-slate-300 hover:text-accent" title="Editar">✏️</button>
                      <button (click)="openDeleteConfirm(item)" class="p-1 text-slate-500 dark:text-slate-300 hover:text-error" title="Excluir">🗑️</button>
                    </div>
                  </div>
                  <div class="mt-4 grid grid-cols-2 gap-4 items-baseline">
                    <div>
                      <p class="text-sm text-slate-600 dark:text-slate-300">Fornecedor Pref.: <span class="font-medium">{{ getSupplierName(item.preferredSupplierId) }}</span></p>
                      <p class="text-sm text-slate-500 dark:text-slate-400">Ponto Ressup.: <span class="font-medium">{{ item.reorderPoint }}</span></p>
                    </div>
                    <div class="text-right">
                      <p class="text-lg font-bold" [class.text-error]="item.quantity <= item.reorderPoint">
                        {{ item.quantity }} <span class="text-sm font-normal text-slate-500 dark:text-slate-400">un.</span>
                      </p>
                      <button (click)="openAdjustmentModal(item)" class="text-xs text-accent dark:text-sky-400 hover:underline cursor-pointer">Ajustar</button>
                    </div>
                  </div>
                </div>
              </div>
            } @empty {
              <div class="p-4 text-center text-slate-500 dark:text-slate-400 bg-white dark:bg-secondary rounded-lg">Nenhum item encontrado.</div>
            }
        </div>
      </div>

      <!-- Pagination -->
      <div class="flex justify-between items-center pt-4">
        <span class="text-sm text-slate-500 dark:text-slate-400">
          Mostrando {{ paginatedItems().length }} de {{ sortedItems().length }} itens
        </span>
        <div class="flex gap-2">
          <button [disabled]="currentPage() === 1" (click)="prevPage()" class="px-3 py-1 bg-white dark:bg-secondary rounded disabled:opacity-50">Anterior</button>
          <button [disabled]="currentPage() === totalPages()" (click)="nextPage()" class="px-3 py-1 bg-white dark:bg-secondary rounded disabled:opacity-50">Próximo</button>
        </div>
      </div>
    </div>

    <!-- Item Form Modal -->
    @if (isFormOpen()) {
      <div class="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-40">
        <div class="bg-white dark:bg-primary p-6 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
          <h3 class="text-xl font-bold mb-4">{{ currentItem()?.id ? 'Editar' : 'Adicionar' }} Item</h3>
          <form [formGroup]="itemForm" (ngSubmit)="saveItem()" class="flex-grow overflow-y-auto pr-2">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm mb-1">Nome</label>
                  <input type="text" formControlName="name" class="w-full bg-slate-100 dark:bg-secondary p-2 rounded" />
                </div>
                <div>
                    <label class="block text-sm mb-1">Categoria</label>
                    <div class="flex items-start gap-2">
                        <div class="flex-grow">
                          <select formControlName="category" class="w-full bg-slate-100 dark:bg-secondary p-2 rounded">
                              @for (cat of db().categories; track cat) {
                                  <option [value]="cat">{{cat}}</option>
                              }
                          </select>
                           @if(aiSuggestions().category) {
                              <div class="mt-2 text-sm">
                                <button type="button" (click)="applySuggestion('category')" class="bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200 px-2 py-1 rounded-md hover:bg-sky-200 w-full text-left">
                                  Usar sugestão: <span class="font-bold">{{ aiSuggestions().category }}</span>
                                </button>
                              </div>
                            }
                        </div>
                        <button type="button" [disabled]="!geminiService.isConfigured() || !itemForm.value.name || isAiLoading()" (click)="suggestCategory()" class="p-2 bg-accent rounded disabled:opacity-50 shrink-0" title="Sugerir Categoria com IA">
                           @if(isAiLoading()) {
                                <div class="w-5 h-5 border-2 border-slate-400 border-t-white rounded-full animate-spin"></div>
                           } @else { <span>✨</span> }
                        </button>
                    </div>
                </div>
                @if (!currentItem()?.id) {
                    <div class="md:col-span-2">
                      <label class="block text-sm mb-1">Qtd. Inicial (Opcional)</label>
                      <input type="number" formControlName="quantity" class="w-full bg-slate-100 dark:bg-secondary p-2 rounded" />
                    </div>
                }
                <div>
                  <label class="block text-sm mb-1">Preço (R$)</label>
                  <input type="number" formControlName="price" class="w-full bg-slate-100 dark:bg-secondary p-2 rounded" />
                </div>
                <div>
                  <label class="block text-sm mb-1">Fornecedor Preferencial</label>
                  <select formControlName="preferredSupplierId" class="w-full bg-slate-100 dark:bg-secondary p-2 rounded">
                    <option [ngValue]="null">Nenhum</option>
                    @for(supplier of db().suppliers; track supplier.id) {
                      <option [value]="supplier.id">{{ supplier.name }}</option>
                    }
                  </select>
                </div>
                <div class="md:col-span-2">
                  <label class="block text-sm mb-1">Descrição</label>
                   <div class="flex items-start gap-2">
                        <div class="flex-grow">
                           <textarea formControlName="description" rows="3" class="w-full bg-slate-100 dark:bg-secondary p-2 rounded"></textarea>
                            @if(aiSuggestions().description) {
                              <div class="mt-2 text-sm p-2 bg-slate-100 dark:bg-secondary rounded">
                                  <p class="font-semibold mb-1">Sugestão da IA:</p>
                                  <p class="italic text-slate-600 dark:text-slate-300 mb-2">"{{ aiSuggestions().description }}"</p>
                                  <button type="button" (click)="applySuggestion('description')" class="bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200 px-2 py-1 rounded-md hover:bg-sky-200 text-xs">
                                    Usar esta descrição
                                  </button>
                              </div>
                            }
                        </div>
                        <button type="button" [disabled]="!geminiService.isConfigured() || !itemForm.value.name || isAiLoading()" (click)="generateDescription()" class="p-2 bg-accent rounded self-start disabled:opacity-50 shrink-0" title="Gerar Descrição com IA">
                          @if(isAiLoading()) {
                                <div class="w-5 h-5 border-2 border-slate-400 border-t-white rounded-full animate-spin"></div>
                           } @else { <span>✍️</span> }
                        </button>
                   </div>
                </div>
                <div class="md:col-span-2">
                    <label class="block text-sm mb-1">Ponto de Ressuprimento</label>
                    <div class="flex items-start gap-2">
                        <div class="flex-grow">
                           <input type="number" formControlName="reorderPoint" class="w-full bg-slate-100 dark:bg-secondary p-2 rounded" />
                           @if(aiSuggestions().reorderPoint; as rp) {
                                <div class="mt-2 text-sm p-2 bg-slate-100 dark:bg-secondary rounded">
                                    <p class="font-semibold mb-1">Sugestão da IA: <button type="button" (click)="applySuggestion('reorderPoint')" class="font-bold text-accent hover:underline">{{ rp.suggestion }}</button></p>
                                    <p class="text-xs text-slate-500 dark:text-slate-400">{{ rp.reasoning }}</p>
                                </div>
                            }
                        </div>
                        <button type="button" [disabled]="!geminiService.isConfigured() || !currentItem()?.id || isAiLoading()" (click)="suggestReorderPoint()" class="p-2 bg-accent rounded disabled:opacity-50 shrink-0" title="Sugerir Ponto de