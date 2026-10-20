import { Component, input, output } from '@angular/core';
import { IonButton, IonSkeletonText } from '@ionic/angular/standalone';

@Component({
  selector: 'sa-list',
  imports: [IonButton, IonSkeletonText],
  template: `
    <div class="sa-query">
      <div class="sa-query__bar">
        <ng-content select="[saFilters]" />
      </div>

      @if (loading()) {
        <div class="sa-skeleton">
          <ion-skeleton-text [animated]="true"></ion-skeleton-text>
          <ion-skeleton-text [animated]="true"></ion-skeleton-text>
          <ion-skeleton-text [animated]="true"></ion-skeleton-text>
          <ion-skeleton-text [animated]="true"></ion-skeleton-text>
          <ion-skeleton-text [animated]="true"></ion-skeleton-text>
        </div>
      } @else if (empty()) {
        <div class="sa-empty">
          <div class="title">{{ emptyTitle() }}</div>
          @if (emptyText()) { <div class="text">{{ emptyText() }}</div> }
        </div>
      } @else {
        <ng-content />
      }

      @if (!loading() && foot()) {
        <div class="sa-query__foot">
          <span>{{ range() }}</span>
          @if (pages() > 1) {
            <div class="sa-pages">
              <ion-button size="small" fill="outline" [disabled]="page() <= 1"
                          (click)="pageChange.emit(page() - 1)">Anterior</ion-button>
              <span class="sa-count">Página {{ page() }} de {{ pages() }}</span>
              <ion-button size="small" fill="outline" [disabled]="page() >= pages()"
                          (click)="pageChange.emit(page() + 1)">Siguiente</ion-button>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class SaList {
  readonly loading = input(false);
  readonly empty = input(false);
  readonly emptyTitle = input('Sin resultados');
  readonly emptyText = input('');
  readonly foot = input(true);
  readonly range = input('');
  readonly page = input(1);
  readonly pages = input(1);
  readonly pageChange = output<number>();
}
