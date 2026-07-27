import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-placeholder-page',
  template: `
    <section class="placeholder-page">
      <h1>{{ title }}</h1>
      <p>{{ description }}</p>
      <p class="coming-soon">Coming soon</p>
    </section>
  `,
  styles: [
    `
      .placeholder-page {
        max-width: 640px;
        margin: 0 auto;
        padding: 80px 20px;
        text-align: center;
      }
      h1 {
        margin: 0 0 12px;
        color: var(--accent-blue);
        font-size: 2.2em;
      }
      p {
        margin: 0;
        color: var(--text-secondary);
        line-height: 1.5;
      }
      .coming-soon {
        margin-top: 24px;
        color: var(--text-tertiary);
        font-size: 0.95em;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
    `,
  ],
})
export class PlaceholderPageComponent {
  @Input({ required: true }) title!: string;
  @Input({ required: true }) description!: string;
}
