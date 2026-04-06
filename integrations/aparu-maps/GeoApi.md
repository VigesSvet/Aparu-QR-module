# **Aparu Maps API \- Техническая документация** {#aparu-maps-api---техническая-документация}

Руководство для участников хакатона

## **Содержание**

	

[Обзор	1](#обзор)

[Аутентификация	2](#аутентификация)

[Базовый URL и общие сведения	2](#базовый-url-и-общие-сведения)

[1\. Геокодинг	2](#1.-геокодинг)

[1.1 Прямой геокодинг \- поиск адреса по тексту	2](#1.1-прямой-геокодинг---поиск-адреса-по-тексту)

[1.2 Обратный геокодинг \- адрес по координатам	4](#1.2-обратный-геокодинг---адрес-по-координатам)

[2\. Маршрутизация	6](#2.-маршрутизация)

[2.1 Построить маршрут (2 точки)	6](#2.1-построить-маршрут-\(2-точки\))

[2.2 Маршрут с промежуточными точками	9](#2.2-маршрут-с-промежуточными-точками)

[3\. Отображение карты \- Leaflet \+ OpenStreetMap	9](#3.-отображение-карты---leaflet-+-openstreetmap)

[3.1 Подключение Leaflet	9](#3.1-подключение-leaflet)

[3.2 Минимальный пример	10](#3.2-минимальный-пример)

[3.3 Маркеры, попапы и события	10](#3.3-маркеры,-попапы-и-события)

[3.4 Отрисовка маршрута на карте	10](#3.4-отрисовка-маршрута-на-карте)

[Коды ошибок	11](#коды-ошибок)

[Быстрый старт \- полный пример	11](#быстрый-старт---полный-пример)

[Полезные формулы	14](#полезные-формулы)

[Справочная таблица эндпоинтов	14](#справочная-таблица-эндпоинтов)

---

## **Обзор** {#обзор}

Aparu Maps API предоставляет набор HTTP-эндпоинтов для работы с геоданными:

* **Геокодинг** \- поиск адресов по тексту и определение адреса по координатам.  
* **Маршрутизация** \- построение автомобильных маршрутов между точками с пошаговыми инструкциями.

Для отображения карты рекомендуем использовать библиотеку **Leaflet** с тайлами **OpenStreetMap** (см. раздел 3).

Все ответы возвращаются в формате **JSON**. Все запросы используют метод **POST** с телом в формате JSON.

---

## **Аутентификация** {#аутентификация}

Каждый запрос к API **обязательно** должен содержать заголовок:

**X-Api-Key: test1**

**Пример заголовков запроса:**

Content-Type: application/json  
X-Api-Key: your\_api\_key\_here

---

## **Базовый URL и общие сведения** {#базовый-url-и-общие-сведения}

| Параметр | Значение |
| ----- | ----- |
| **Базовый URL** | `http://testtaxi3.aparu.kz` |
| **Протокол** | HTTPS |
| **Формат тела** | JSON (`application/json`) |
| **Формат ответа** | JSON (`application/json`) |

---

## **1\. Геокодинг** {#1.-геокодинг}

### **1.1 Прямой геокодинг \- поиск адреса по тексту** {#1.1-прямой-геокодинг---поиск-адреса-по-тексту}

Ищет адреса по текстовому запросу с учётом близости к переданным координатам.

**Эндпоинт:**

POST /api/v1/maps/geocode

**Заголовки:**

| Заголовок | Значение |
| ----- | ----- |
| Content-Type | `application/json` |
| X-Api-Key | `<ваш_ключ>` |

**Параметры тела запроса:**

| Параметр | Тип | Обязательный | Описание |
| ----- | ----- | ----- | ----- |
| `text` | string | ✅ | Поисковый текст, максимум 150 символов |
| `latitude` | number | ✅ | Широта для приоритета близости |
| `longitude` | number | ✅ | Долгота для приоритета близости |
| `withCities` | boolean | ❌ | Включить города в результаты (по умолчанию `true`) |

**Пример запроса:**

curl \-X POST http://testtaxi3.aparu.kz/api/v1/maps/geocode \\  
  \-H "Content-Type: application/json" \\  
  \-H "X-Api-Key: your\_api\_key\_here" \\  
  \-d '{  
    "text": "Абая 1",  
    "latitude": 49.9483,  
    "longitude": 82.6135,  
    "withCities": true  
  }'

**Пример ответа (200 OK):**

{  
  "results": \[  
    {  
      "address": "ул. Абая, 1",  
      "additionalInfo": "Усть-Каменогорск",  
      "latitude": 49.9483,  
      "longitude": 82.6135,  
      "type": "h"  
    },  
    {  
      "address": "ул. Абая, 1А",  
      "additionalInfo": "Усть-Каменогорск",  
      "latitude": 49.9485,  
      "longitude": 82.6140,  
      "type": "h"  
    }  
  \]  
}

**Типы результатов (поле `type`):**

| Значение | Описание |
| ----- | ----- |
| `s` | Улица |
| `h` | Дом (точный адрес) |
| `o` | Особое место (аэропорт, ТЦ и т.д.) |
| `c` | Населённый пункт |

**Поля ответа (`results[]`):**

| Поле | Тип | Описание |
| ----- | ----- | ----- |
| `address` | string | Найденный адрес |
| `additionalInfo` | string | Город / доп. информация |
| `latitude` | number | Широта результата |
| `longitude` | number | Долгота результата |
| `type` | string | Тип результата (см. таблицу выше) |

---

### **1.2 Обратный геокодинг \- адрес по координатам** {#1.2-обратный-геокодинг---адрес-по-координатам}

Определяет адрес, район/область и ближайший населённый пункт по координатам.

**Эндпоинт:**

POST /api/v1/maps/reverse-geocode

**Параметры тела запроса:**

| Параметр | Тип | Обязательный | Описание |
| ----- | ----- | ----- | ----- |
| `latitude` | number | ✅ | Широта (от \-90 до 90\) |
| `longitude` | number | ✅ | Долгота (от \-180 до 180\) |

**Пример запроса:**

curl \-X POST http://testtaxi3.aparu.kz/api/v1/maps/reverse-geocode \\  
  \-H "Content-Type: application/json" \\  
  \-H "X-Api-Key: your\_api\_key\_here" \\  
  \-d '{  
    "latitude": 49.9483,  
    "longitude": 82.6135  
  }'

**Пример ответа (200 OK):**

{  
  "placeName": "ул. Абая, 1",  
  "areaName": "Усть-Каменогорск",  
  "accuratePlace": true,  
  "locality": {  
    "localityId": 8,  
    "name": "Усть-Каменогорск",  
    "latitude": 49.9483,  
    "longitude": 82.6135  
  }  
}

**Поля ответа:**

| Поле | Тип | Описание |
| ----- | ----- | ----- |
| `placeName` | string | Название места / адрес |
| `areaName` | string | Район / область |
| `accuratePlace` | boolean | `true` \- адрес определён точно |
| `locality` | object | Информация о ближайшем населённом пункте |

**Объект `locality`:**

| Поле | Тип | Описание |
| ----- | ----- | ----- |
| `localityId` | number | Идентификатор населённого пункта |
| `name` | string | Название населённого пункта |
| `latitude` | number | Широта центра населённого пункта |
| `longitude` | number | Долгота центра населённого пункта |

---

## **2\. Маршрутизация** {#2.-маршрутизация}

### **2.1 Построить маршрут (2 точки)** {#2.1-построить-маршрут-(2-точки)}

Строит автомобильный маршрут между двумя и более точками.

**Эндпоинт:**

POST /api/v1/maps/route

**Параметры тела запроса:**

| Параметр | Тип | Обязательный | Описание |
| ----- | ----- | ----- | ----- |
| `points` | array | ✅ | Массив точек маршрута (минимум 2 точки) |

**Объект точки (`points[]`):**

| Поле | Тип | Описание |
| ----- | ----- | ----- |
| `latitude` | number | Широта |
| `longitude` | number | Долгота |

**Пример запроса:**

curl \-X POST http://testtaxi3.aparu.kz/api/v1/maps/route \\  
  \-H "Content-Type: application/json" \\  
  \-H "X-Api-Key: your\_api\_key\_here" \\  
  \-d '{  
    "points": \[  
      { "latitude": 49.9483, "longitude": 82.6135 },  
      { "latitude": 49.9550, "longitude": 82.6200 }  
    \]  
  }'

**Пример ответа (200 OK):**

{  
  "distance": 1250.5,  
  "time": 180000,  
  "coordinates": \[  
    \[82.6135, 49.9483\],  
    \[82.6150, 49.9490\],  
    \[82.6200, 49.9550\]  
  \],  
  "bbox": \[82.6135, 49.9483, 82.6200, 49.9550\],  
  "instructions": \[  
    {  
      "distance": 500.2,  
      "time": 60000,  
      "text": "Двигайтесь на север по ул. Абая",  
      "streetName": "ул. Абая",  
      "sign": 0,  
      "interval": \[0, 1\]  
    },  
    {  
      "distance": 750.3,  
      "time": 120000,  
      "text": "Поверните направо",  
      "streetName": "ул. Ленина",  
      "sign": 2,  
      "interval": \[1, 2\]  
    }  
  \]  
}

**Поля ответа:**

| Поле | Тип | Описание |
| ----- | ----- | ----- |
| `distance` | number | Расстояние маршрута в **метрах** |
| `time` | number | Время в пути в **миллисекундах** |
| `coordinates` | array | Массив координат маршрута в формате `[lng, lat]` |
| `bbox` | array | Ограничивающий прямоугольник `[minLon, minLat, maxLon, maxLat]` |
| `instructions` | array | Пошаговые инструкции навигации |

**Объект инструкции (`instructions[]`):**

| Поле | Тип | Описание |
| ----- | ----- | ----- |
| `distance` | number | Расстояние до следующего манёвра (метры) |
| `time` | number | Время до следующего манёвра (миллисекунды) |
| `text` | string | Текстовая инструкция |
| `streetName` | string | Название улицы |
| `sign` | number | Код манёвра (см. таблицу ниже) |
| `interval` | array | Индексы в массиве `coordinates` \- начало и конец отрезка |

**Коды манёвров (поле `sign`):**

| Значение | Описание |
| ----- | ----- |
| `-3` | Резкий поворот налево |
| `-2` | Поворот налево |
| `-1` | Слегка налево |
| `0` | Прямо |
| `1` | Слегка направо |
| `2` | Поворот направо |
| `3` | Резкий поворот направо |
| `4` | Финиш (конец маршрута) |
| `5` | Промежуточная точка |
| `6` | Круговое движение |

**Ответ при ошибке (400 Bad Request):**

{  
  "code": "ROUTE\_NOT\_FOUND",  
  "message": "Маршрут не найден. Проверьте координаты точек"  
}

---

### **2.2 Маршрут с промежуточными точками** {#2.2-маршрут-с-промежуточными-точками}

Тот же эндпоинт `POST /api/v1/maps/route`, но в массиве `points` передаётся 3 и более точек. Промежуточные точки обозначаются в инструкциях значением `sign: 5`.

**Пример запроса (3 точки):**

curl \-X POST http://testtaxi3.aparu.kz/api/v1/maps/route \\  
  \-H "Content-Type: application/json" \\  
  \-H "X-Api-Key: your\_api\_key\_here" \\  
  \-d '{  
    "points": \[  
      { "latitude": 49.9483, "longitude": 82.6135 },  
      { "latitude": 49.9520, "longitude": 82.6180 },  
      { "latitude": 49.9550, "longitude": 82.6200 }  
    \]  
  }'

---

## **3\. Отображение карты \- Leaflet \+ OpenStreetMap** {#3.-отображение-карты---leaflet-+-openstreetmap}

Для визуализации результатов API (адреса, маршруты) на карте используйте библиотеку [Leaflet](https://leafletjs.com/) с тайлами OpenStreetMap.

Полная документация и туториалы: https://leafletjs.com/examples/quick-start/

### **3.1 Подключение Leaflet** {#3.1-подключение-leaflet}

Добавьте CSS и JS в `<head>` вашей HTML-страницы:

\<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"  
  integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="  
  crossorigin="" /\>  
\<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"  
  integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="  
  crossorigin=""\>\</script\>

Создайте контейнер для карты с заданной высотой:

\<div id="map" style="width: 100%; height: 100vh;"\>\</div\>

### **3.2 Минимальный пример** {#3.2-минимальный-пример}

// Инициализация карты с центром в Усть-Каменогорске  
const map \= L.map('map').setView(\[49.9483, 82.6135\], 13);

// Подключение тайлов OpenStreetMap  
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {  
  maxZoom: 19,  
  attribution: '\&copy; \<a href="https://www.openstreetmap.org/copyright"\>OpenStreetMap\</a\> contributors'  
}).addTo(map);

### **3.3 Маркеры, попапы и события** {#3.3-маркеры,-попапы-и-события}

**Добавление маркера с попапом:**

const marker \= L.marker(\[49.9483, 82.6135\]).addTo(map);  
marker.bindPopup('\<b\>ул. Абая, 1\</b\>\<br\>Усть-Каменогорск').openPopup();

**Обработка клика по карте:**

map.on('click', async (e) \=\> {  
  const { lat, lng } \= e.latlng;

  // Обратный геокодинг по клику  
  const result \= await reverseGeocode(lat, lng);  
  L.popup()  
    .setLatLng(e.latlng)  
    .setContent(\`\<b\>${result.placeName}\</b\>\<br\>${result.areaName}\`)  
    .openOn(map);  
});

### **3.4 Отрисовка маршрута на карте** {#3.4-отрисовка-маршрута-на-карте}

API маршрутизации возвращает координаты в формате `[lng, lat]`, а Leaflet работает с `[lat, lng]`. Не забывайте разворачивать массив:

// Получаем маршрут из API  
const route \= await buildRoute(\[  
  { latitude: 49.9483, longitude: 82.6135 },  
  { latitude: 49.9550, longitude: 82.6200 }  
\]);

// Конвертируем \[lng, lat\] → \[lat, lng\]  
const latLngs \= route.coordinates.map((\[lng, lat\]) \=\> \[lat, lng\]);

// Рисуем линию маршрута  
const polyline \= L.polyline(latLngs, {  
  color: '\#3b82f6',  
  weight: 5,  
  opacity: 0.8  
}).addTo(map);

// Маркеры старта и финиша  
L.marker(latLngs\[0\]).addTo(map).bindPopup('Старт');  
L.marker(latLngs\[latLngs.length \- 1\]).addTo(map).bindPopup('Финиш');

// Подогнать карту под маршрут  
map.fitBounds(polyline.getBounds(), { padding: \[40, 40\] });

---

## **Коды ошибок** {#коды-ошибок}

| HTTP-код | Код ошибки | Описание |
| ----- | ----- | ----- |
| 400 | `ROUTE_NOT_FOUND` | Маршрут не найден \- проверьте координаты точек |
| 401 | \- | Отсутствует или невалидный API-ключ |
| 422 | \- | Некорректные параметры запроса |

---

## **Быстрый старт \- полный пример** {#быстрый-старт---полный-пример}

Готовый HTML-файл: карта OpenStreetMap \+ геокодинг \+ маршрут через Aparu API.

\<\!DOCTYPE html\>  
\<html lang="ru"\>  
\<head\>  
  \<meta charset="UTF-8"\>  
  \<meta name="viewport" content="width=device-width, initial-scale=1.0"\>  
  \<title\>Aparu Maps \- Быстрый старт\</title\>  
  \<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"  
    integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="  
    crossorigin="" /\>  
  \<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"  
    integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="  
    crossorigin=""\>\</script\>  
  \<style\>  
    body { margin: 0; }  
    \#map { width: 100vw; height: 100vh; }  
  \</style\>  
\</head\>  
\<body\>  
  \<div id="map"\>\</div\>  
  \<script\>  
    const API\_KEY \= 'YOUR\_API\_KEY\_HERE';  
    const BASE\_URL \= 'http://testtaxi3.aparu.kz';

    // 1\. Инициализация карты с тайлами OpenStreetMap  
    const map \= L.map('map').setView(\[49.9483, 82.6135\], 13);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {  
      maxZoom: 19,  
      attribution: '\&copy; \<a href="https://www.openstreetmap.org/copyright"\>OpenStreetMap\</a\> contributors'  
    }).addTo(map);

    // 2\. Функция прямого геокодинга  
    async function searchAddress(text, lat, lng) {  
      const response \= await fetch(\`${BASE\_URL}/api/v1/maps/geocode\`, {  
        method: 'POST',  
        headers: {  
          'Content-Type': 'application/json',  
          'X-Api-Key': API\_KEY  
        },  
        body: JSON.stringify({  
          text: text,  
          latitude: lat,  
          longitude: lng,  
          withCities: true  
        })  
      });  
      return await response.json();  
    }

    // 3\. Функция обратного геокодинга  
    async function reverseGeocode(lat, lng) {  
      const response \= await fetch(\`${BASE\_URL}/api/v1/maps/reverse-geocode\`, {  
        method: 'POST',  
        headers: {  
          'Content-Type': 'application/json',  
          'X-Api-Key': API\_KEY  
        },  
        body: JSON.stringify({ latitude: lat, longitude: lng })  
      });  
      return await response.json();  
    }

    // 4\. Функция построения маршрута  
    async function buildRoute(points) {  
      const response \= await fetch(\`${BASE\_URL}/api/v1/maps/route\`, {  
        method: 'POST',  
        headers: {  
          'Content-Type': 'application/json',  
          'X-Api-Key': API\_KEY  
        },  
        body: JSON.stringify({ points })  
      });  
      return await response.json();  
    }

    // 5\. Строим маршрут и показываем на карте  
    (async () \=\> {  
      const route \= await buildRoute(\[  
        { latitude: 49.9483, longitude: 82.6135 },  
        { latitude: 49.9550, longitude: 82.6200 }  
      \]);

      // \[lng, lat\] → \[lat, lng\]  
      const latLngs \= route.coordinates.map((\[lng, lat\]) \=\> \[lat, lng\]);

      const polyline \= L.polyline(latLngs, {  
        color: '\#3b82f6',  
        weight: 5  
      }).addTo(map);

      L.marker(latLngs\[0\]).addTo(map).bindPopup('Старт');  
      L.marker(latLngs\[latLngs.length \- 1\]).addTo(map).bindPopup('Финиш');

      map.fitBounds(polyline.getBounds(), { padding: \[40, 40\] });

      const km \= (route.distance / 1000).toFixed(1);  
      const minutes \= Math.ceil(route.time / 60000);  
      console.log(\`Маршрут: ${km} км, \~${minutes} мин\`);  
    })();

    // 6\. Обратный геокодинг по клику  
    map.on('click', async (e) \=\> {  
      const { lat, lng } \= e.latlng;  
      const result \= await reverseGeocode(lat, lng);  
      L.popup()  
        .setLatLng(e.latlng)  
        .setContent(\`\<b\>${result.placeName}\</b\>\<br\>${result.areaName}\`)  
        .openOn(map);  
    });  
  \</script\>  
\</body\>  
\</html\>

---

## **Полезные формулы** {#полезные-формулы}

**Конвертация времени маршрута:**

const totalSeconds \= route.time / 1000;  
const minutes \= Math.floor(totalSeconds / 60);  
const seconds \= Math.round(totalSeconds % 60);  
console.log(\`Время в пути: ${minutes} мин ${seconds} сек\`);

**Конвертация расстояния:**

const km \= (route.distance / 1000).toFixed(1);  
console.log(\`Расстояние: ${km} км\`);

**Конвертация координат API ↔ Leaflet:**

// API возвращает \[lng, lat\], Leaflet ожидает \[lat, lng\]  
const toLeaflet \= (\[lng, lat\]) \=\> \[lat, lng\];  
const toApi \= (\[lat, lng\]) \=\> ({ latitude: lat, longitude: lng });

---

## **Справочная таблица эндпоинтов** {#справочная-таблица-эндпоинтов}

| Метод | Эндпоинт | Описание |
| ----- | ----- | ----- |
| `POST` | `/api/v1/maps/geocode` | Прямой геокодинг (текст → координаты) |
| `POST` | `/api/v1/maps/reverse-geocode` | Обратный геокодинг (координаты → адрес) |
| `POST` | `/api/v1/maps/route` | Построение автомобильного маршрута |

