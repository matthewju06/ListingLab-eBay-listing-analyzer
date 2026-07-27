import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ShellSearchService } from '../../services/shell-search.service';

@Component({
  selector: 'app-home',
  imports: [FormsModule],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class HomeComponent {
  private readonly shellSearch = inject(ShellSearchService);

  query = '';

  submitSearch(): void {
    const q = this.query.trim();
    if (!q) return;

    this.shellSearch.query = q;
    this.shellSearch.submitSearch();
  }
}
