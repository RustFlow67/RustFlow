# SHIFT — источники и ограничения базы железа

Срез: 23 ноября 2026 года. База содержит модели для выбора пользователем, а не подтверждение наличия товара или цены в конкретном магазине России. Числа `idx` — приблизительные относительные коэффициенты модели, а не замеры Rust или гарантия FPS/1% low. Реальные результаты зависят от игры, сервера, охлаждения, памяти и драйверов.

## Источники

- AMD: [Ryzen 9 9950X3D2](https://www.amd.com/en/products/processors/desktops/ryzen/9000-series/amd-ryzen-9-9950x3d2-dual-edition.html), [Ryzen 7 9850X3D](https://www.amd.com/en/products/processors/desktops/ryzen/9000-series/amd-ryzen-7-9850x3d.html).
- Intel: [Core Ultra Series 2](https://www.intel.com/content/www/us/en/ark/products/series/241071/intel-core-ultra-processors-series-2.html) и [анонс 200S Plus](https://www.intel.com/content/www/us/en/newsroom/news/client-computing/intel-announces-new-intel-core-ultra-200s-plus-series-desktop-processors.html).
- Ryzen 7 7700X3D: [Tom's Hardware, обзор](https://www.tomshardware.com/pc-components/cpus/amd-ryzen-7-7700x3d-cpu-review); Ryzen 5 7500X3D: [VideoCardz](https://videocardz.com/newz/amd-ryzen-5-7500x3d-launches-at-269-6-core-cpu-with-3d-v-cache-is-13-faster-than-core-ultra-245kf-in-gaming).
- Radeon RX 9070 GRE: [характеристики и региональный выпуск](https://www.techspot.com/specs/gpu/325498-amd-radeon-rx-9070-gre.html); 12 ГБ VRAM.
- Core Ultra 9 290K Plus не добавлен как розничный процессор: [сообщалось об отмене его выпуска Intel](https://www.dlcompare.com/gaming-news/intel-cancels-core-ultra-9-290k-plus-cpu-in-last-minute-change-of-plans-73954). Записи в отдельных каталогах и тесты инженерных образцов не подтверждают продажу.

Команды Rust могут измениться между обновлениями. Проверяйте их в F1 и создавайте резервную копию перед изменениями. Нельзя гарантировать совместимость с античитом или фиксированное количество кадров. SHIFT не меняет affinity, парковку ядер, бинды, чувствительность, FOV, звук, HUD или сетевые настройки автоматически при применении графического профиля. Доступность апскейлеров и драйверных технологий зависит от игры, GPU и версии драйвера.
