import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Symbol } from '../models/symbol.model';

@Injectable({
  providedIn: 'root',
})
export class SymbolService {
  private http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiBaseUrl}/api/symbol/favorite`;

  getFavorites(): Observable<Symbol[]> {
    return this.http.get<Symbol[]>(this.apiUrl);
  }
} 