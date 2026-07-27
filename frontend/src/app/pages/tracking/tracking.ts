import { Component } from '@angular/core';
import { PlaceholderPageComponent } from '../placeholder/placeholder-page';

@Component({
  selector: 'app-tracking',
  imports: [PlaceholderPageComponent],
  template: `
    <app-placeholder-page
      title="Price Tracking"
      description="Follow a query over time and watch price trends. Tracking jobs will live on this page."
    />
  `,
})
export class TrackingComponent {}
