import { AppController } from './app.js';

const app = new AppController();

window.app = app; 

app.fetchData();