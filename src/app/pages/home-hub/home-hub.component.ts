import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { MARCA_NOME } from '../../constants/loja-public';

@Component({
  selector: 'app-home-hub',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './home-hub.component.html',
  styleUrls: ['./home-hub.component.scss'],
})
export class HomeHubComponent implements OnInit {
  readonly marca = MARCA_NOME;

  constructor(private title: Title) {}

  ngOnInit(): void {
    this.title.setTitle(`${this.marca} · tutores, loja ou parceiros`);
  }
}
