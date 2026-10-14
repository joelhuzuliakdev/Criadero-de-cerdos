// Íconos de Tabler (https://tabler.io/icons), importados desde @tabler/icons.
// Solo se incluyen en el sitio los íconos listados acá.
import alertTriangle from '@tabler/icons/outline/alert-triangle.svg?raw';
import arrowLeft from '@tabler/icons/outline/arrow-left.svg?raw';
import babyCarriage from '@tabler/icons/outline/baby-carriage.svg?raw';
import buildingWarehouse from '@tabler/icons/outline/building-warehouse.svg?raw';
import calendar from '@tabler/icons/outline/calendar.svg?raw';
import calendarHeart from '@tabler/icons/outline/calendar-heart.svg?raw';
import cashBanknote from '@tabler/icons/outline/cash-banknote.svg?raw';
import check from '@tabler/icons/outline/check.svg?raw';
import chevronRight from '@tabler/icons/outline/chevron-right.svg?raw';
import circleCheck from '@tabler/icons/outline/circle-check.svg?raw';
import droplet from '@tabler/icons/outline/droplet.svg?raw';
import eye from '@tabler/icons/outline/eye.svg?raw';
import grain from '@tabler/icons/outline/grain.svg?raw';
import infoCircle from '@tabler/icons/outline/info-circle.svg?raw';
import layoutDashboard from '@tabler/icons/outline/layout-dashboard.svg?raw';
import lock from '@tabler/icons/outline/lock.svg?raw';
import logout from '@tabler/icons/outline/logout.svg?raw';
import menu2 from '@tabler/icons/outline/menu-2.svg?raw';
import pencil from '@tabler/icons/outline/pencil.svg?raw';
import pig from '@tabler/icons/outline/pig.svg?raw';
import plus from '@tabler/icons/outline/plus.svg?raw';
import printer from '@tabler/icons/outline/printer.svg?raw';
import receipt2 from '@tabler/icons/outline/receipt-2.svg?raw';
import reportMoney from '@tabler/icons/outline/report-money.svg?raw';
import search from '@tabler/icons/outline/search.svg?raw';
import settings from '@tabler/icons/outline/settings.svg?raw';
import shoppingCart from '@tabler/icons/outline/shopping-cart.svg?raw';
import trash from '@tabler/icons/outline/trash.svg?raw';
import trendingDown from '@tabler/icons/outline/trending-down.svg?raw';
import trendingUp from '@tabler/icons/outline/trending-up.svg?raw';
import users from '@tabler/icons/outline/users.svg?raw';
import x from '@tabler/icons/outline/x.svg?raw';

const ICONOS = {
    'alert-triangle': alertTriangle,
    'arrow-left': arrowLeft,
    'baby-carriage': babyCarriage,
    'building-warehouse': buildingWarehouse,
    calendar,
    'calendar-heart': calendarHeart,
    'cash-banknote': cashBanknote,
    check,
    'chevron-right': chevronRight,
    'circle-check': circleCheck,
    droplet,
    eye,
    grain,
    'info-circle': infoCircle,
    'layout-dashboard': layoutDashboard,
    lock,
    logout,
    'menu-2': menu2,
    pencil,
    pig,
    plus,
    printer,
    'receipt-2': receipt2,
    'report-money': reportMoney,
    search,
    settings,
    'shopping-cart': shoppingCart,
    trash,
    'trending-down': trendingDown,
    'trending-up': trendingUp,
    users,
    x,
} as const;

export type NombreIcono = keyof typeof ICONOS;

/** Devuelve el SVG del ícono como texto, listo para insertar en HTML. */
export function icono(nombre: NombreIcono, clase = 'icon'): string {
    const svg = ICONOS[nombre] ?? '';
    return svg
    .replace(/\s+/g, ' ')
    .replace(/<path stroke="none" d="M0 0h24v24H0z" fill="none" ?\/>/, '')
    .replace(/class="[^"]*"/, `class="${clase}" aria-hidden="true"`)
    .replace(/ width="24" height="24"/, '')
    .trim();
}