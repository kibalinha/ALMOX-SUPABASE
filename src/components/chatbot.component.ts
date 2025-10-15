import { Component, ChangeDetectionStrategy, inject, signal, viewChild, ElementRef, effect, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatbotService } from '../services/chatbot.service';
import { ChatMessage, View } from '../models';

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    @keyframes fadeIn {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }
    @keyframes fadeOut {
      from { opacity: 1; transform: scale(1); }
      to { opacity: 0; transform: scale(0.95); }
    }
    .chat-window-enter {
      animation: fadeIn 0.2s ease-out forwards;
    }
    .chat-window-leave {
      animation: fadeOut 0.2s ease-in forwards;
    }
    
    /* Styles for AI-generated HTML content */
    :host ::ng-deep .chatbot-message-content table {
      width: 100%;
      margin: 8px 0;
      border-collapse: collapse;
      font-size: 0.875rem; /* text-sm */
    }
    :host ::ng-deep .chatbot-message-content th,
    :host ::ng-deep .chatbot-message-content td {
      border: 1px solid #e2e8f0; /* slate-200 */
      padding: 6px 8px;
      text-align: left;
    }
    :host ::ng-deep .chatbot-message-content th {
      background-color: #f1f5f9; /* slate-100 */
      font-weight: 600;
    }
    :host ::ng-deep .chatbot-message-content ul {
        list-style: disc;
        padding-left: 20px;
    }
    :host ::ng-deep .chatbot-message-content li {
        margin-bottom: 4px;
    }

    /* Dark mode styles for AI-generated HTML */
    :host-context(.dark) ::ng-deep .chatbot-message-content th,
    :host-context(.dark) ::ng-deep .chatbot-message-content td {
      border-color: #475569; /* slate-600 */
    }
    :host-context(.dark) ::ng-deep .chatbot-message-content th {
      background-color: #334155; /* slate-700 */
    }
  `],
  template: `
    <div class="fixed bottom-6 right-6 z-50">
      <!-- FAB -->
      <button 
        (click)="toggleChat()" 
        class="bg-accent text-white w-16 h-16 rounded-full shadow-lg flex items-center justify-center hover:bg-info transition-transform duration-200 hover:scale-110">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10 2a6 6 0 00-6 6v3.586l-1.707 1.707A1 1 0 003 15h14a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
        </svg>
      </button>

      <!-- Chat Window -->
      @if (isChatOpen()) {
        <div 
          class="absolute bottom-20 right-0 w-80 sm:w-96 h-[32rem] bg-white dark:bg-primary rounded-xl shadow-2xl flex flex-col overflow-hidden chat-window-enter"
          (keydown.escape)="toggleChat()"
        >
          <header class="p-4 bg-slate-100 dark:bg-secondary border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
            <h3 class="font-bold">Almox - Assistente IA</h3>
            <button (click)="toggleChat()" class="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 text-2xl font-bold">&times;</button>
          </header>

          <div #chatContainer class="flex-grow p-4 overflow-y-auto space-y-4">
            @for (message of history(); track $index) {
              <div class="flex" [class.justify-end]="message.role === 'user'">
                <div 
                  class="max-w-xs lg:max-w-sm px-4 py-2 rounded-lg"
                  [class.bg-accent]="message.role === 'user'"
                  [class.text-white]="message.role === 'user'"
                  [class.bg-slate-100]="message.role === 'model'"
                  [class.dark:bg-secondary]="message.role === 'model'"
                >
                  <div class="chatbot-message-content" [innerHTML]="message.parts[0].text || ''"></div>
                </div>
              </div>
            }
            @if (isLoading()) {
              <div class="flex">
                  <div class="max-w-xs lg:max-w-sm px-4 py-2 rounded-lg bg-slate-100 dark:bg-secondary flex items-center">
                      <div class="w-2 h-2 bg-accent rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                      <div class="w-2 h-2 bg-accent rounded-full animate-bounce [animation-delay:-0.15s] mx-1"></div>
                      <div class="w-2 h-2 bg-accent rounded-full animate-bounce"></div>
                  </div>
              </div>
            }
          </div>
          
          @if (suggestions().length > 0 && !isLoading()) {
            <div class="p-2 border-t border-slate-200 dark:border-slate-700 flex flex-wrap gap-2">
              @for (suggestion of suggestions(); track suggestion) {
                <button (click)="useSuggestion(suggestion)" class="text-xs bg-slate-200 dark:bg-secondary px-3 py-1 rounded-full hover:bg-slate-300 dark:hover:bg-primary">
                  {{ suggestion }}
                </button>
              }
            </div>
          }

          <div class="p-2 border-t border-slate-200 dark:border-slate-700">
            <form (ngSubmit)="sendMessage()" class="flex gap-2">
              <input 
                type="text" 
                [(ngModel)]="userInput"
                name="userInput"
                placeholder="Digite sua mensagem..."
                class="w-full bg-slate-100 dark:bg-secondary p-2 rounded-md border-none focus:ring-2 focus:ring-accent focus:outline-none"
                [disabled]="isLoading()"
              >
              <button type="submit" [disabled]="isLoading() || !userInput().trim()" class="bg-accent text-white px-4 py-2 rounded-md disabled:opacity-50">
                Enviar
              </button>
            </form>
          </div>
        </div>
      }
    </div>
  `
})
export class ChatbotComponent {
  navigateTo = output<View>();
  private chatbotService = inject(ChatbotService);

  isChatOpen = signal(false);
  isLoading = signal(false);
  userInput = signal('');
  history = signal<ChatMessage[]>([
    { role: 'model', parts: [{ text: 'Olá! Como posso ajudar você hoje?' }], suggestions: ['Listar itens com estoque baixo', 'Registrar saída de 2 parafusos para Ana'] }
  ]);
  suggestions = signal<string[]>(['Listar itens com estoque baixo', 'Registrar saída de 2 parafusos para Ana']);

  chatContainer = viewChild<ElementRef>('chatContainer');
  
  constructor() {
    effect(() => {
      if (this.history() && this.chatContainer()) {
        this.scrollToBottom();
      }
    });
  }

  toggleChat() {
    this.isChatOpen.update(v => !v);
  }

  async sendMessage() {
    const message = this.userInput().trim();
    if (!message || this.isLoading()) return;

    this.history.update(h => [...h, { role: 'user', parts: [{ text: message }] }]);
    this.userInput.set('');
    this.isLoading.set(true);
    this.suggestions.set([]);

    try {
        const response = await this.chatbotService.sendMessage(this.history(), message);
        
        // Check for navigation tool call in response
        const functionResponse = response.toolResponses?.[0]?.functionResponse;
        if (functionResponse?.name === 'navigateTo' && functionResponse?.response?.content?.navigateTo) {
            this.navigateTo.emit(functionResponse.response.content.navigateTo);
        }

        this.history.update(h => [...h, response]);
        this.suggestions.set(response.suggestions || []);
    } catch (e) {
        this.history.update(h => [...h, { role: 'model', parts: [{ text: 'Desculpe, ocorreu um erro.' }] }]);
    } finally {
        this.isLoading.set(false);
    }
  }

  useSuggestion(suggestion: string) {
    this.userInput.set(suggestion);
    this.sendMessage();
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const el = this.chatContainer()?.nativeElement;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    }, 0);
  }
}
