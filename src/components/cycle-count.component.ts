import { Component, ChangeDetectionStrategy, inject, signal, viewChild, ElementRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators, FormControl } from '@angular/forms';
import { DatabaseService } from '../services/database.service';
import { GeminiService } from '../services/gemini.service';
import { ToastService } from '../services/toast.service';
import { Item } from '../models';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';

@Component({
  selector: 'app-cycle-count',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-4 sm:p-6 h-full flex flex-col">
        <header class="mb-6">
            <h2 class="text-2xl font-bold">Contagem Cíclica (Inventário Rotativo)</h2>
            <p class="text-sm text-slate-500 dark:text-slate-400">Realize contagens parciais e inteligentes para manter a acurácia do seu estoque.</p>
        </header>

        <div class="flex-grow overflow-y-auto min-h-0">
            @switch(step()) {
                @case('idle') {
                    <div class="text-center p-10 bg-white dark:bg-primary rounded-lg flex flex-col items-center justify-center h-full border-2 border-dashed border-slate-300 dark:border-secondary">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 text-slate-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-5 3h2m-2 4h4m-4 4h4" />
                        </svg>
                        <p class="text-lg font-semibold">Pronto para iniciar uma nova contagem?</p>
                        <p class="text-slate-500 dark:text-slate-400 mt-2 max-w-md">A IA irá sugerir um conjunto de itens para contagem, focando nos mais relevantes para a operação.</p>
                        <button (click)="startNewCount()" [disabled]="isLoading()" class="mt-6 bg-accent text-white px-6 py-3 rounded-md hover:bg-info transition-colors flex items-center justify-center w-52 disabled:opacity-50">
                            @if(isLoading()) {
                                <div class="w-5 h-5 border-2 border-slate-400 border-t-white rounded-full animate-spin"></div>
                            } @else {
                                <span>Iniciar Nova Contagem</span>
                            }
                        </button>
                    </div>
                }
                @case('counting') {
                    <div class="bg-white dark:bg-primary p-6 rounded-lg shadow-md">
                        <div class="flex justify-between items-start mb-6">
                            <div class="bg-sky-100 dark:bg-sky-900/50 border border-sky-200 dark:border-sky-700 p-4 rounded-md flex-grow">
                                <h3 class="font-bold text-sky-800 dark:text-sky-200">Sugestão da IA</h3>
                                <p class="text-sm text-sky-700 dark:text-sky-300 mt-1">{{ suggestionReason() }}</p>
                            </div>
                            <button (click)="startScanner()" class="ml-4 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2 h-full">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 4a1 1 0 011-1h4a1 1 0 010 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h4a1 1 0 010 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h4a1 1 0 010 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h4a1 1 0 010 2H4a1 1 0 01-1-1zm14-8a1 1 0 00-1-1h-4a1 1 0 000 2h4a1 1 0 001-1zm-1 4a1 1 0 01-1 1h-4a1 1 0 010-2h4a1 1 0 011 1zm-1 4a1 1 0 01-1 1h-4a1 1 0 010-2h4a1 1 0 011 1z" clip-rule="evenodd" /></svg>
                                Escanear Item
                            </button>
                        </div>

                        <form [formGroup]="countForm">
                            <!-- Table for desktop -->
                            <table class="w-full text-left hidden md:table">
                                <thead>
                                    <tr class="border-b dark:border-slate-600">
                                        <th class="p-2 w-3/5">Item</th>
                                        <th class="p-2 text-center">Estoque no Sistema</th>
                                        <th class="p-2">Quantidade Contada</th>
                                    </tr>
                                </thead>
                                <tbody formArrayName="itemsToCount">
                                    @for(control of itemsToCountArray.controls; track $index; let i = $index) {
                                        <tr [formGroupName]="$index" class="border-b dark:border-slate-700" #itemRow>
                                            <td class="p-2">{{ itemsToCount()[i].name }}</td>
                                            <td class="p-2 text-center">{{ itemsToCount()[i].quantity }}</td>
                                            <td class="p-2">
                                                <input type="number" formControlName="countedQuantity" min="0" class="w-full bg-slate-100 dark:bg-secondary p-2 rounded">
                                            </td>
                                        </tr>
                                    }
                                </tbody>
                            </table>

                            <!-- Cards for mobile -->
                            <div formArrayName="itemsToCount" class="space-y-3 md:hidden">
                                @for(control of itemsToCountArray.controls; track $index; let i = $index) {
                                    <div [formGroupName]="$index" class="bg-slate-50 dark:bg-secondary p-4 rounded-lg" #itemRow>
                                        <p class="font-bold text-slate-800 dark:text-slate-100">{{ itemsToCount()[i].name }}</p>
                                        <p class="text-sm text-slate-500 dark:text-slate-400">Em sistema: {{ itemsToCount()[i].quantity }}</p>
                                        <div class="mt-2">
                                            <label class="block text-sm font-medium mb-1">Qtd. Contada</label>
                                            <input type="number" formControlName="countedQuantity" min="0" class="w-full bg-white dark:bg-primary p-2 rounded">
                                        </div>
                                    </div>
                                }
                            </div>

                            <div class="flex justify-end gap-4 mt-6">
                                <button type="button" (click)="reset()" class="px-4 py-2 bg-slate-200 dark:bg-secondary rounded">Cancelar</button>
                                <button type="button" (click)="reviewCount()" [disabled]="countForm.invalid" class="px-