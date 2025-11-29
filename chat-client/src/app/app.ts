import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router'; // 1. Import cái này

@Component({
  selector: 'app-root',
  standalone: true,
  // 2. Thêm RouterOutlet vào mảng imports
  imports: [RouterOutlet], 
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {

}