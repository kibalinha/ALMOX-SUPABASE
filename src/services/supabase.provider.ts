import { Injectable } from '@angular/core';
import { DataProvider, CollectionWithId, CreationPayload } from './data.provider';
import { AlmoxarifadoDB, Item, Movement, AuditLog, Technician, Supplier, RedShelfItem, PurchaseOrder, PickingList, Kit, Reservation, User } from '../models';
import { supabase } from './supabase.client';
import { PostgrestError } from '@supabase/supabase-js';

// Mapeia os nomes das coleções do modelo para os nomes das tabelas no Supabase (snake_case)
const collectionToTableMap: Record<string, string> = {
  items: 'items',
  redShelfItems: 'red_shelf_items',
  technicians: 'technicians',
  suppliers: 'suppliers',
  movements: 'movements',
  auditLogs: 'audit_logs',
  purchaseOrders: 'purchase_orders',
  pickingLists: 'picking_lists',
  kits: 'kits',
  reservations: 'reservations',
  users: 'users',
};

@Injectable()
export class SupabaseProvider extends DataProvider {

  private async handleResponse<T>(response: { data: T | null; error: PostgrestError | null }): Promise<T> {
    if (response.error) {
        console.error('Supabase error:', response.error);
        throw new Error(response.error.message);
    }
    if (response.data === null) {
        // Para operações de exclusão, data pode ser nulo em sucesso.
        // A verificação de erro acima já cobriria falhas.
        // Para outras operações, isso pode indicar um problema.
        console.warn('Supabase operation returned null data.');
    }
    return response.data as T;
  }

  async getInitialData(): Promise<AlmoxarifadoDB> {
    const tables = ['items', 'red_shelf_items', 'technicians', 'suppliers', 'movements', 'audit_logs', 'purchase_orders', 'picking_lists', 'kits', 'reservations', 'users', 'categories'];
    const promises = tables.map(name => supabase.from(name).select('*'));

    try {
      const results = await Promise.all(promises);

      const [items, redShelfItems, technicians, suppliers, movements, auditLogs, purchaseOrders, pickingLists, kits, reservations, users, categoriesResult] = results.map(r => {
        if (r.error) throw r.error;
        // Supabase retorna snake_case, a aplicação espera camelCase para algumas colunas
        // Por simplicidade, vamos assumir que a maioria das colunas não precisa de mapeamento, exceto as chaves estrangeiras.
        return r.data?.map((d: any) => this.snakeToCamel(d)) || [];
      });
      
      const categories = (categoriesResult as {name: string}[]).map(c => c.name);

      return { items, redShelfItems, technicians, suppliers, movements, categories, auditLogs, purchaseOrders, pickingLists, kits, reservations, users };
    } catch (error) {
      console.error('Failed to load initial data from Supabase', error);
      return { items: [], redShelfItems: [], technicians: [], suppliers: [], movements: [], categories: [], auditLogs: [], purchaseOrders: [], pickingLists: [], kits: [], reservations: [], users: [] };
    }
  }

  async replaceAllData(db: AlmoxarifadoDB): Promise<void> {
    console.log("Iniciando restauração do banco de dados...");
    const tablesToDelete = ['movements', 'picking_lists', 'purchase_orders', 'reservations', 'kits', 'items', 'red_shelf_items', 'technicians', 'suppliers', 'users', 'audit_logs', 'categories'];

    try {
        // Fase de exclusão
        for (const tableName of tablesToDelete) {
            const key = tableName === 'categories' ? 'name' : 'id';
            const { error } = await supabase.from(tableName).delete().neq(key, crypto.randomUUID());
            if (error) throw error;
        }

        // Fase de inserção (ordem inversa das dependências)
        if (db.categories?.length) await supabase.from('categories').insert(db.categories.map(name => ({ name })));
        if (db.auditLogs?.length) await supabase.from('audit_logs').insert(db.auditLogs.map(this.camelToSnake));
        if (db.users?.length) await supabase.from('users').insert(db.users.map(this.camelToSnake));
        if (db.suppliers?.length) await supabase.from('suppliers').insert(db.suppliers.map(this.camelToSnake));
        if (db.technicians?.length) await supabase.from('technicians').insert(db.technicians.map(this.camelToSnake));
        if (db.redShelfItems?.length) await supabase.from('red_shelf_items').insert(db.redShelfItems.map(this.camelToSnake));
        if (db.items?.length) await supabase.from('items').insert(db.items.map(this.camelToSnake));
        if (db.kits?.length) await supabase.from('kits').insert(db.kits.map(this.camelToSnake));
        if (db.reservations?.length) await supabase.from('reservations').insert(db.reservations.map(this.camelToSnake));
        if (db.purchaseOrders?.length) await supabase.from('purchase_orders').insert(db.purchaseOrders.map(this.camelToSnake));
        if (db.pickingLists?.length) await supabase.from('picking_lists').insert(db.pickingLists.map(this.camelToSnake));
        if (db.movements?.length) await supabase.from('movements').insert(db.movements.map(this.camelToSnake));

        console.log("Restauração do banco de dados concluída com sucesso.");
        return Promise.resolve();

    } catch (error) {
        console.error('Falha na restauração do banco de dados:', error);
        throw new Error(`Falha na restauração do banco de dados: ${(error as PostgrestError).message}`);
    }
  }

  async addItem<T extends { id: string }>(collection: CollectionWithId, item: CreationPayload<T>): Promise<T> {
    const tableName = collectionToTableMap[collection];
    const itemSnakeCase = this.camelToSnake(item);
    const { data, error } = await supabase.from(tableName).insert(itemSnakeCase).select().single();
    if (error) throw new Error(error.message);
    return this.snakeToCamel(data) as T;
  }

  async updateItem<T extends { id: string }>(collection: CollectionWithId, updatedItem: T): Promise<T> {
    const tableName = collectionToTableMap[collection];
    const itemSnakeCase = this.camelToSnake(updatedItem);
    const { data, error } = await supabase.from(tableName).update(itemSnakeCase).eq('id', updatedItem.id).select().single();
    if (error) throw new Error(error.message);
    return this.snakeToCamel(data) as T;
  }

  async updateMultipleItems<T extends { id: string }>(collection: CollectionWithId, updatedItems: T[]): Promise<T[]> {
    const tableName = collectionToTableMap[collection];
    const itemsSnakeCase = updatedItems.map(this.camelToSnake);
    const { data, error } = await supabase.from(tableName).upsert(itemsSnakeCase).select();
    if (error) throw new Error(error.message);
    return data.map(this.snakeToCamel) as T[];
  }

  async deleteItem(collection: CollectionWithId, id: string): Promise<void> {
    const tableName = collectionToTableMap[collection];
    const { error } = await supabase.from(tableName).delete().eq('id', id);
    if (error) throw new Error(error.message);
  }

  async deleteMultipleItems(collection: CollectionWithId, ids: string[]): Promise<void> {
    const tableName = collectionToTableMap[collection];
    const { error } = await supabase.from(tableName).delete().in('id', ids);
    if (error) throw new Error(error.message);
  }
  
  async addMultipleItems(itemsToAdd: Omit<Item, "id" | "createdAt">[], isRedShelf: boolean): Promise<(Item | RedShelfItem)[]> {
    const tableName = isRedShelf ? 'red_shelf_items' : 'items';
    const itemsSnakeCase = itemsToAdd.map(this.camelToSnake);
    const { data, error } = await supabase.from(tableName).insert(itemsSnakeCase).select();
    if (error) throw new Error(error.message);
    return data.map(this.snakeToCamel) as (Item | RedShelfItem)[];
  }

  async logAction(action: string, details: string, user: string): Promise<AuditLog> {
    const { data, error } = await supabase.from('audit_logs').insert({ action, details, user }).select().single();
    if (error) throw new Error(error.message);
    return this.snakeToCamel(data) as AuditLog;
  }

  async addCategory(categoryName: string, existingCategories: string[]): Promise<string[]> {
    const { error } = await supabase.from('categories').insert({ name: categoryName });
    if (error) throw new Error(error.message);
    const { data: allCategories } = await supabase.from('categories').select('name');
    return allCategories?.map(c => c.name) || [];
  }

  async addCategories(categoryNames: string[], existingCategories: string[]): Promise<string[]> {
    const newCategories = categoryNames.map(name => ({ name }));
    const { error } = await supabase.from('categories').upsert(newCategories, { onConflict: 'name' });
    if (error) throw new Error(error.message);
    const { data: allCategories } = await supabase.from('categories').select('name');
    return allCategories?.map(c => c.name) || [];
  }

  async deleteCategory(categoryToDelete: string, currentDb: AlmoxarifadoDB): Promise<{ updatedItems: Item[]; updatedRedShelfItems: RedShelfItem[]; updatedCategories: string[]; } | null> {
    // A transação seria ideal, mas para simplificar, faremos sequencialmente.
    // 1. Atualizar itens que usam esta categoria
    const { data: itemsToUpdate, error: fetchError } = await supabase.from('items').select('id').eq('category', categoryToDelete);
    if (fetchError) throw new Error(fetchError.message);

    if (itemsToUpdate && itemsToUpdate.length > 0) {
        const { error: updateError } = await supabase.from('items').update({ category: 'Outros' }).eq('category', categoryToDelete);
        if (updateError) throw new Error(updateError.message);
    }
    
    // 2. Deletar a categoria
    const { error: deleteError } = await supabase.from('categories').delete().eq('name', categoryToDelete);
    if (deleteError) throw new Error(deleteError.message);

    // 3. Retornar o novo estado (simplificado, o `database.service` irá recarregar)
    const updatedItems = currentDb.items.map(i => i.category === categoryToDelete ? { ...i, category: 'Outros' } : i);
    const updatedCategories = currentDb.categories.filter(c => c !== categoryToDelete);

    return { updatedItems, updatedRedShelfItems: currentDb.redShelfItems, updatedCategories };
  }

  async addMovement(movementData: Omit<Movement, "id">): Promise<{ success: boolean; message: string; newMovement?: Movement; updatedItem?: Item | RedShelfItem; }> {
    const { data, error } = await supabase.rpc('add_movement', {
        p_item_id: movementData.itemId,
        p_type: movementData.type,
        p_quantity: movementData.quantity,
        p_date: movementData.date,
        p_technician_id: movementData.technicianId,
        p_notes: movementData.notes,
    });

    if (error) {
        console.error('Error in add_movement RPC:', error);
        return { success: false, message: error.message };
    }
    
    // Converte a resposta do RPC para camelCase
    const result = {
        newMovement: this.snakeToCamel(data.newMovement) as Movement,
        updatedItem: this.snakeToCamel(data.updatedItem) as Item | RedShelfItem,
    };
    return { success: true, message: 'Movimentação registrada.', ...result };
  }

  async adjustItemQuantity(itemId: string, newQuantity: number, notes: string, isRedShelf: boolean): Promise<{ updatedItem: Item | RedShelfItem; newMovement: Movement; }> {
     const { data, error } = await supabase.rpc('adjust_quantity', {
        p_item_id: itemId,
        p_new_quantity: newQuantity,
        p_notes: notes,
        p_is_red_shelf: isRedShelf
    });

    if (error) {
        console.error('Error in adjust_quantity RPC:', error);
        throw new Error(error.message);
    }
     // Converte a resposta do RPC para camelCase
    return {
        newMovement: this.snakeToCamel(data.newMovement) as Movement,
        updatedItem: this.snakeToCamel(data.updatedItem) as Item | RedShelfItem,
    };
  }
  
  // Funções utilitárias para conversão de chaves
  private snakeToCamel(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map(v => this.snakeToCamel(v));
    }
    return Object.keys(obj).reduce((acc: any, key) => {
      const camelKey = key.replace(/_([a-z])/g, g => g[1].toUpperCase());
      acc[camelKey] = this.snakeToCamel(obj[key]);
      return acc;
    }, {});
  }
  
  private camelToSnake(obj: any): any {
     if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map(v => this.camelToSnake(v));
    }
     return Object.keys(obj).reduce((acc: any, key) => {
      const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      // Evita converter chaves que já estão em snake_case ou são especiais
      if(key === 'poNumber') { // Exceção para PO Number
        acc['po_number'] = obj[key];
      } else {
        acc[snakeKey] = this.camelToSnake(obj[key]);
      }
      return acc;
    }, {});
  }
}
