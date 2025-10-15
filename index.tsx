import '@angular/compiler';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { AppComponent } from './src/app.component';
import { provideZonelessChangeDetection, LOCALE_ID } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { provideRouter, withHashLocation, withComponentInputBinding } from '@angular/router';
import { APP_ROUTES } from './src/app.routes';

// --- ARQUITETURA DE DADOS ---
// A aplicação utiliza um provedor de dados abstrato para permitir a troca
// entre diferentes fontes de dados.
import { DataProvider } from './src/services/data.provider';
// Para usar um backend Supabase (padrão):
import { SupabaseProvider } from './src/services/supabase.provider';
// Para usar o armazenamento local (localStorage) em modo offline:
// import { LocalStorageProvider } from './src/services/local-storage.provider';
// Para usar um backend HTTP customizado:
// import { HttpProvider } from './src/services/http.provider';


// Registra os dados de localização para o português do Brasil.
registerLocaleData(localePt);

document.addEventListener('DOMContentLoaded', () => {
  bootstrapApplication(AppComponent, {
    providers: [
      provideZonelessChangeDetection(),
      provideHttpClient(),
      provideRouter(APP_ROUTES, withHashLocation(), withComponentInputBinding()),
      // Define o local padrão da aplicação como 'pt-BR'.
      { provide: LOCALE_ID, useValue: 'pt-BR' },
      
      // --- CONFIGURAÇÃO DO PROVEDOR DE DADOS ---
      // Para usar o Supabase (padrão):
      { provide: DataProvider, useClass: SupabaseProvider },

      // Para usar o localStorage (modo offline), comente a linha acima e descomente a abaixo.
      // { provide: DataProvider, useClass: LocalStorageProvider },
      
      // Para conectar a um backend ASP.NET, comente as outras e descomente a linha abaixo.
      // Lembre-se também de descomentar o conteúdo do arquivo 'src/services/http.provider.ts'.
      // { provide: DataProvider, useClass: HttpProvider },
    ],
  }).catch((err) => console.error(err));
});


// AI Studio always uses an `index.tsx` file for all project types$.

// AI Studio always uses an `index.tsx` file for all project types.
