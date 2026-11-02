# Сторонние компоненты и материалы

Общая лицензия на собственный код проекта пока не выбрана. Этот документ описывает сторонние компоненты и не предоставляет общую лицензию на весь репозиторий.

## Библиотеки и шрифты

| Компонент | Условия | Локальный текст |
| --- | --- | --- |
| Phaser | MIT | [Phaser-MIT.txt](public/licenses/Phaser-MIT.txt) |
| EventEmitter3 | MIT | [EventEmitter3-MIT.txt](public/licenses/EventEmitter3-MIT.txt) |
| IBM Plex Sans | SIL Open Font License 1.1 | [IBM-Plex-Sans-OFL.txt](public/licenses/IBM-Plex-Sans-OFL.txt) |
| IBM Plex Mono | SIL Open Font License 1.1 | [IBM-Plex-Mono-OFL.txt](public/licenses/IBM-Plex-Mono-OFL.txt) |
| Unbounded — сохранённая зависимость, не подключённая к интерфейсу | SIL Open Font License 1.1 | [Unbounded-OFL.txt](public/licenses/Unbounded-OFL.txt) |

IBM Plex Sans хранится в `src/assets/fonts/ibm-plex-sans-variable.ttf`; исходный файл содержит copyright IBM Corp., 2019, и указание OFL 1.1. IBM Plex Mono подключён через пакет `@fontsource/ibm-plex-mono`. Версии остальных зависимостей и инструментов зафиксированы в `package-lock.json`; их собственные условия находятся в установленных пакетах.

Публичная копия использует IBM Plex Sans и IBM Plex Mono. Прежние Gotico и Magistral исключены из репозитория; оригиналы сохранены владельцем локально.

## Фирменные материалы

Логотипы К2 НейроТех, KageCore и Starguard, а также макет паспорта ИИ-зрелости включены с разрешения владельца проекта на публичное размещение:

- `src/assets/k2-neurotech-logo.svg`;
- `src/assets/brands/kagecore.svg`;
- `src/assets/brands/starguard.png`;
- `src/assets/ai-maturity-passport.png`.

Разрешение на размещение этих файлов в этом репозитории не является общей открытой лицензией на фирменные материалы или товарные знаки. Отдельное разрешение на их дальнейшее использование здесь не предоставляется.

Игровые спрайты и простые значки формируются кодом; звуки синтезируются Web Audio. Базы, контакты участников, исходные ТЗ и редакционные материалы в состав публикации не входят.
