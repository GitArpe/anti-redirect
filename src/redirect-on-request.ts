import {Observable} from 'rxjs/Observable';
import {http, Response$, timeout} from './http';
import {CONFIG} from './config';


const DEBUG = CONFIG.debug;
const status = {
  ing: 'redirect-ing',
  done: 'redirect-done'
};
let inview;

class RedirectOnRequest {
  public match: boolean;
  public DEBUG = DEBUG;
  public status: any = status;

  constructor(public domainTester, public urlTester, public matcher, public ASelector = 'a') {
    this.match = domainTester.test(document.domain);
  }

  handlerOneEle(aElement: HTMLAnchorElement): void {
    if (!this.urlTester.test(aElement.href) || aElement.getAttribute(status.ing) || aElement.getAttribute(status.done)) return;
    let url: string = aElement.href.replace(/^https?/, 'https') + `&timestamp=${new Date().getTime()}`;
    aElement.style.cursor = 'progress';
    aElement.setAttribute(status.ing, '1');
    http.get(url)
      .retry(2)
      .timeout(timeout)
      .map((res: Response$)=> {
        if (this.urlTester.test(res.finalUrl)) {
          if (!res.response || /<\/noscript>$/.test(res.response.trim())) throw res;
          let url = res.response.match(/URL=\'?https?:\/\/[^'"]+/).join('').match(/https?:\/\/[^'"]+/)[0];
          if (!url || !/^https?/.test(url) || this.urlTester.test(url)) throw res;
          res.finalUrl = url;
        }
        return res;
      })
      .subscribe(function (res: Response$): void {
        aElement.href = res.finalUrl;
        aElement.removeAttribute(status.ing);
        aElement.setAttribute(status.done, '1');
        DEBUG && (aElement.style.backgroundColor = 'green');
      }, function (err: Response$): void {
        aElement.style.cursor = null;
        aElement.removeAttribute(status.ing);
      }, function (): void {
        aElement.style.cursor = null;
        aElement.removeAttribute(status.ing);
      });
  }

  handlerOneEleOneByOne() {
    Observable.from([].slice.call(document.querySelectorAll('#content_left a')))
      .subscribe((aElement: HTMLAnchorElement): void => {
        inview && inview.is(aElement) && this.handlerOneEle(aElement);
      })
  }

  handlerAll(...agm): void {

  }

  handlerAllOne(...agm): void {

  }

  scroll(): Observable<any> {
    return Observable.fromEvent(window, 'scroll')
      .debounce(()=>Observable.timer(200))
  }

  mouseover(): Observable<HTMLAnchorElement> {
    return Observable.fromEvent(document, 'mousemove')
      .throttle(()=>Observable.timer(100))
      .map((event: any): HTMLAnchorElement=> {
        let target = event.toElement;
        return target.nodeName === 'A' ? target : target.parentNode.nodeName === 'A' ? target.parentNode : target;
      })
      .filter((ele: HTMLAnchorElement)=>ele.nodeName === 'A');
  }

  log(str?: string): void {
    console.log(str || 'boostrap anti-redirect');
  }

  bootstrap(): void {
    if (!this.match) return;
    Observable.fromEvent(document, 'DOMContentLoaded')
      .delay(500)
      .do(()=> {
        inview = require('in-view');
        inview('#content_left a').on('enter', (aEle: HTMLAnchorElement) => {
          this.handlerOneEle(aEle);
        });
      })
      .do(()=> {
        this.handlerAll();
      })
      .flatMap((): Observable<void>=> {
        return Observable.create((observer) => {
          new MutationObserver((mutations = [])=> {
            if (!mutations.length) return;
            observer.next();
          }).observe(document.body, {childList: true})
        }).debounce(()=>Observable.timer(500));
      })
      .subscribe(()=> {

        this.log();

        this.scroll().subscribe(()=> {
          this.handlerOneEleOneByOne();
        });

        this.mouseover().subscribe((aEle)=> {
          this.handlerOneEle(aEle);
        });

        this.handlerAll();
        this.handlerOneEleOneByOne();

      });
  }
}

export {RedirectOnRequest};