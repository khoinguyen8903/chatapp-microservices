import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { FriendsComponent } from './friends.component';

const friendsRoutes: Routes = [
  {
    path: '',
    component: FriendsComponent
  }
];

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule.forChild(friendsRoutes)
  ],
  exports: []
})
export class FriendsModule { }

// Note: All components are standalone and are imported directly where needed
