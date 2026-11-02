# Corrección de bots por rango

Se eliminó la mezcla de órdenes de conducción: cada coche usa un único conductor.

- Bronce: bot básico activo, con reacción y precisión limitadas. Se acerca al balón y puede golpearlo; no se limita a quedarse parado ni a avanzar casi sin acelerar.
- Plata y Oro: bot de reglas con anticipación, recuperación, defensa y preparación de tiros. Su reacción y velocidad suben dentro de estos rangos.
- Platino, Diamante, Campeón y Gran Campeón: Nexto completo controla el coche, con dificultad graduada mediante la política de acciones y reacción. Sus órdenes ya no se diluyen con las de otro controlador.
- Leyenda Supersónica: Nexto al máximo, con la misma selección de acciones y respuesta máximas.

Los compañeros siguen algo por debajo de los rivales, conservando el mismo tipo de conductor del rango de la partida. La progresión es propia de Rocket Arena y no una equivalencia certificada con jugadores humanos de RL.

Comprobación realizada con la física real: Bronce, Plata, Oro, Platino, Diamante y Supersónico alcanzan y golpean un balón situado a 9 metros. En ese escenario sin portero, Plata y superiores también marcaron. Esto verifica que conducen y actúan; no mide por sí solo su nivel en una partida humana.

La carpeta JUEGO-COMPLETO-ACTUALIZADO-PARA-GITHUB contiene el juego completo actualizado. Sube su contenido a la raíz del repositorio, confirma el reemplazo de archivos y espera a que Pages y Render desplieguen el commit. Después recarga con Ctrl+F5. Reinicia cualquier servidor LAN que estuviera abierto.
