import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class SymbolService {
  private readonly apiUrl = 'http://localhost:5050/api/symbol/favorite'; // Adjust if backend runs on a different port

  constructor(private http: HttpClient) {}

  getFavorites(): Observable<string[]> {
    return this.http.get<string[]>(this.apiUrl);
  }
} 