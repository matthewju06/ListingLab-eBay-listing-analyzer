import { Component } from '@angular/core';
import { PlaceholderPageComponent } from '../placeholder/placeholder-page';

@Component({
  selector: 'app-saved',
  imports: [PlaceholderPageComponent],
  template: `
    <app-placeholder-page
      title="Saved Searches"
      description="Pin queries and filters you want to reopen quickly. Persistence and sync will land here."
    />
  `,
})
export class SavedComponent {}
