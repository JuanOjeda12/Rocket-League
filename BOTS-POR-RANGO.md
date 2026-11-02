# Bots por rango

- Bronce: bot basico programado.
- Plata: bot tactico programado.
- Oro: Necto V1 reducido (beta .25, decisiones cada 24 ticks).
- Platino: Necto V1 reducido (beta .55, 16 ticks).
- Diamante: Necto V1 reducido (beta .85, 10 ticks).
- Campeon: Nexto reducido.
- Gran Campeon: Nexto ligeramente reducido.
- Leyenda Supersonica: Nexto maximo, argmax y 8 ticks.

Necto y Nexto son dos modelos oficiales diferentes. Los valores se interpolan dentro de cada rango. Los companeros de jugadores humanos conservan el mismo modelo de su rango y usan un nivel algo inferior. No se mezclan controles de distintos bots. Las etiquetas son una calibracion propia, no una certificacion del rango humano real.

Subir todos los archivos del parche conservando engine/necto/ y server/. Esperar Pages y Render y recargar con Ctrl+F5. No requiere cambios SQL.
