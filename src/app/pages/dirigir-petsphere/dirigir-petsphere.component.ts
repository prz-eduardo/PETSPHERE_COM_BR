import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { MARCA_NOME } from '../../constants/loja-public';

@Component({
  selector: 'app-dirigir-petsphere',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dirigir-petsphere.component.html',
  styleUrls: ['../parceiro-landing-shared/parceiro-landing-shared.scss'],
})
export class DirigirPetsphereComponent implements OnInit {
  readonly marca = MARCA_NOME;

  constructor(private title: Title) {}

  ngOnInit(): void {
    this.title.setTitle(`Dirija na rede ${this.marca} — transporte pet`);
  }
}

