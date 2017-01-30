// issue: https://github.com/DefinitelyTyped/DefinitelyTyped/issues/369
// https://github.com/witoldsz/angular-http-auth/blob/master/src/angular-http-auth.js
/**
 * @license HTTP Auth Interceptor Module for AngularJS
 * (c) 2012 Witold Szczerba
 * License: MIT
 */

/* tslint:disable:no-empty no-shadowed-variable */

class AuthService {
    /**
      * Holds all the requests which failed due to 401 response,
      * so they can be re-requested in future, once login is completed.
      */
    buffer: Array<{ config: ng.IRequestConfig; deferred: ng.IDeferred<any>; }> = [];

    /**
     * Required by HTTP interceptor.
     * Function is attached to provider to be invisible for regular users of this service.
     */
    pushToBuffer = function(config: ng.IRequestConfig, deferred: ng.IDeferred<any>) {
        this.buffer.push({
            config,
            deferred
        });
    };

    $get = [
        '$rootScope', '$injector', function($rootScope: ng.IScope, $injector: ng.auto.IInjectorService) {
            let $http: ng.IHttpService; //initialized later because of circular dependency problem
            function retry(config: ng.IRequestConfig, deferred: ng.IDeferred<any>) {
                $http = $http || $injector.get<ng.IHttpService>('$http');
                $http(config).then(function(response) {
                    deferred.resolve(response);
                });
            }
            function retryAll() {
                for (const request of this.buffer) {
                    retry(request.config, request.deferred);
                }

                this.buffer = [];
            }

            return {
                loginConfirmed() {
                    $rootScope.$broadcast('event:auth-loginConfirmed');
                    retryAll();
                }
            };
        } as any
    ];
}

angular.module('http-auth-interceptor', [])

    .provider('authService', AuthService)

/**
 * $http interceptor.
 * On 401 response - it stores the request and broadcasts 'event:angular-auth-loginRequired'.
 */
    .config(['$httpProvider', 'authServiceProvider', function($httpProvider: ng.IHttpProvider, authServiceProvider: any) {

        $httpProvider.defaults.headers.common = {Authorization: 'Bearer token'};
        $httpProvider.defaults.headers.get['Authorization'] = 'Bearer token';
        $httpProvider.defaults.headers.post['Authorization'] = function(config: ng.IRequestConfig): string { return 'Bearer token'; };

        const interceptor = ['$rootScope', '$q', function($rootScope: ng.IScope, $q: ng.IQService) {
            function success(response: ng.IHttpPromiseCallbackArg<any>) {
                return response;
            }

            function error(response: ng.IHttpPromiseCallbackArg<any>) {
                if (response.status === 401) {
                    const deferred = $q.defer<void>();
                    authServiceProvider.pushToBuffer(response.config, deferred);
                    $rootScope.$broadcast('event:auth-loginRequired');
                    return deferred.promise;
                }
                // otherwise
                return $q.reject(response);
            }

          return function(promise: ng.IHttpPromise<any>) {
                return promise.then(success, error);
            };

      } as any];
        $httpProvider.interceptors.push(interceptor);
    } as any]);

namespace HttpAndRegularPromiseTests {
    interface Person {
        firstName: string;
        lastName: string;
    }

    type ExpectedResponse = Person;

    interface SomeControllerScope extends ng.IScope {
        person: Person;
        theAnswer: number;
        letters: string[];
        snack: string;
        nothing?: string;
    }

    function someController($scope: SomeControllerScope, $http: ng.IHttpService, $q: ng.IQService) {
        $http.get<ExpectedResponse>('http://somewhere/some/resource')
            .success((data: ExpectedResponse) => {
                $scope.person = data;
            });

        $http.get<ExpectedResponse>('http://somewhere/some/resource')
            .then((response: ng.IHttpPromiseCallbackArg<ExpectedResponse>) => {
                // typing lost, so something like
                // var i: number = response.data
                // would type check
                $scope.person = response.data;
            });

        $http.get<ExpectedResponse>('http://somewhere/some/resource')
            .then((response: ng.IHttpPromiseCallbackArg<ExpectedResponse>) => {
                // typing lost, so something like
                // var i: number = response.data
                // would NOT type check
                $scope.person = response.data;
            });

        const aPromise: ng.IPromise<Person> = $q.when({ firstName: 'Jack', lastName: 'Sparrow' });
        aPromise.then((person: Person) => {
            $scope.person = person;
        });

        const bPromise: ng.IPromise<number> = $q.when(42);
        bPromise.then((answer: number) => {
            $scope.theAnswer = answer;
        });

        const cPromise: ng.IPromise<string[]> = $q.when(['a', 'b', 'c']);
        cPromise.then((letters: string[]) => {
            $scope.letters = letters;
        });

        // When $q.when is passed an IPromise<T>, it returns an IPromise<T>
        const dPromise: ng.IPromise<string> = $q.when($q.when('ALBATROSS!'));
        dPromise.then((snack: string) => {
            $scope.snack = snack;
        });

        // $q.when may be called without arguments
        const ePromise: ng.IPromise<void> = $q.when();
        ePromise.then(() => {
            $scope.nothing = 'really nothing';
        });
    }

    // Test that we can pass around a type-checked success/error Promise Callback
    function anotherController($scope: SomeControllerScope, $http: ng.IHttpService, $q: ng.IQService) {
        function buildFooData(): ng.IRequestShortcutConfig {
            return {};
        }

        function doFoo(callback: ng.IHttpPromiseCallback<ExpectedResponse>) {
            $http
                .get<ExpectedResponse>('/foo', buildFooData())
                .success(callback);
        };

        doFoo((data: any) => console.log(data));
    };
}

// Test for AngularJS Syntax

namespace My.Namespace {
    export var x: any; // need to export something for module to kick in
}

// IModule Registering Test
let mod = angular.module('tests', []);
mod.controller('name', function($scope: ng.IScope) { });
mod.controller('name', ['$scope', function($scope: ng.IScope) { }]);
mod.controller('name', class {
    // Uncommenting the next line should lead to a type error because this signature isn't compatible
    // with the signature of the `$onChanges` hook:
    // $onChanges(x: number) { }
});
mod.controller({
    MyCtrl: class{},
    MyCtrl2: function() {}, // tslint:disable-line:object-literal-shorthand
    MyCtrl3: ['$fooService', function($fooService: any) { }]
});
mod.directive('myDirectiveA', ($rootScope: ng.IRootScopeService) => {
    return (scope, el, attrs) => {
        let foo = 'none';
        el.click(e => {
            foo = e.type;
            $rootScope.$apply();
        });
        scope.$watch(() => foo, () => el.text(foo));
    };
});
mod.directive('myDirectiveB', ['$rootScope', function($rootScope: ng.IRootScopeService) {
    return {
        link(scope, el, attrs) {
            el.click(e => {
                el.hide();
            });
        }
    };
}]);
mod.directive({
    myFooDir: () => ({
        template: 'my-foo-dir.tpl.html'
    }),
    myBarDir: ['$fooService', ($fooService: any) => ({
        template: 'my-bar-dir.tpl.html'
    })]
});
mod.factory('name', function($scope: ng.IScope) { });
mod.factory('name', ['$scope', function($scope: ng.IScope) { }]);
mod.factory({
    name1: function(foo: any) { }, // tslint:disable-line:object-literal-shorthand
    name2: ['foo', function(foo: any) { }]
});
mod.filter('name', function($scope: ng.IScope) { });
mod.filter('name', ['$scope', function($scope: ng.IScope) { }]);
mod.filter({
    name1: function(foo: any) { }, // tslint:disable-line:object-literal-shorthand
    name2: ['foo', function(foo: any) { }]
});
mod.provider('name', function($scope: ng.IScope) { return { $get: () => { } }; });
mod.provider('name', TestProvider);
mod.provider('name', ['$scope', function($scope: ng.IScope) { } as any]);
mod.provider(My.Namespace);
mod.service('name', function($scope: ng.IScope) { });
mod.service('name', ['$scope', function($scope: ng.IScope) { } as any]);
mod.service({
    MyCtrl: class{},
    MyCtrl2: function() {}, // tslint:disable-line:object-literal-shorthand
    MyCtrl3: ['$fooService', function($fooService: any) { }]
});
mod.constant('name', 23);
mod.constant('name', '23');
mod.constant(My.Namespace);
mod.value('name', 23);
mod.value('name', '23');
mod.value(My.Namespace);
mod.decorator('name', function($scope: ng.IScope) {});
mod.decorator('name', ['$scope', function($scope: ng.IScope) {} as any]);

class TestProvider implements ng.IServiceProvider {
    constructor(private $scope: ng.IScope) {
    }

    $get() {
    }
}

// QProvider tests
angular.module('qprovider-test', [])
    .config(['$qProvider', function($qProvider: ng.IQProvider) {
        const provider: ng.IQProvider = $qProvider.errorOnUnhandledRejections(false);
        const currentValue: boolean = $qProvider.errorOnUnhandledRejections();
    }]);

// Promise signature tests
let foo: ng.IPromise<number>;
foo.then((x) => {
    // x is inferred to be a number
    return 'asdf';
}).then((x) => {
    // x is inferred to be string
    const len = x.length;
    return 123;
}).then((x) => {
    // x is infered to be a number
    const fixed = x.toFixed();
    return;
}).then((x) => {
    // x is infered to be void
    // Typescript will prevent you to actually use x as a local variable
    // Try object:
    return { a: 123 };
}).then((x) => {
    // Object is inferred here
    x.a = 123;
    //Try a promise
    var y: ng.IPromise<number>;
    return y;
}).then((x) => {
    // x is infered to be a number, which is the resolved value of a promise
    x.toFixed();
});

// $q signature tests
namespace TestQ {
    interface TResult {
        a: number;
        b: string;
        c: boolean;
    }
    interface TValue {
        e: number;
        f: boolean;
    }
    var tResult: TResult;
    var promiseTResult: angular.IPromise<TResult>;
    var tValue: TValue;
    var promiseTValue: angular.IPromise<TValue>;

    var $q: angular.IQService;
    var promiseAny: angular.IPromise<any>;

    // $q constructor
    {
        let result: angular.IPromise<TResult>;
        result = new $q<TResult>((resolve: (value: TResult) => any) => {});
        result = new $q<TResult>((resolve: (value: TResult) => any, reject: (value: any) => any) => {});
        result = $q<TResult>((resolve: (value: TResult) => any) => {});
        result = $q<TResult>((resolve: (value: TResult) => any, reject: (value: any) => any) => {});
    }

    // $q.all
    {
        let result: angular.IPromise<any[]>;
        result = $q.all([promiseAny, promiseAny]);
        // TS should infer that n1 and n2 are numbers and have toFixed.
        $q.all([1, $q.when(2)]).then(([ n1, n2 ]) => n1.toFixed() + n2.toFixed());
        $q.all([1, $q.when(2), '3']).then(([ n1, n2, n3 ]) => n1.toFixed() + n2.toFixed() + n3.slice(1));
    }
    {
        let result: angular.IPromise<TResult[]>;
        result = $q.all<TResult>([promiseAny, promiseAny]);
    }
    {
        let result: angular.IPromise<{[id: string]: any; }>;
        result = $q.all({a: promiseAny, b: promiseAny});
    }
    {
        let result: angular.IPromise<{a: number; b: string; }>;
        result = $q.all<{a: number; b: string; }>({a: promiseAny, b: promiseAny});
    }

    // $q.defer
    {
        let result: angular.IDeferred<TResult>;
        result = $q.defer<TResult>();
    }

    // $q.reject
    {
        let result: angular.IPromise<any>;
        result = $q.reject();
        result = $q.reject('');
    }

    // $q.resolve
    {
        let result: angular.IPromise<void>;
        result = $q.resolve();
    }
    {
        let result: angular.IPromise<TResult>;
        result = $q.resolve<TResult>(tResult);
        result = $q.resolve<TResult>(promiseTResult);
    }

    // $q.when
    {
        let result: angular.IPromise<void>;
        result = $q.when();
    }
    {
        let result: angular.IPromise<TResult>;
        result = $q.when<TResult>(tResult);
        result = $q.when<TResult>(promiseTResult);

        result = $q.when<TResult, TValue>(tValue, (result: TValue) => tResult);
        result = $q.when<TResult, TValue>(tValue, (result: TValue) => tResult, (any) => any);
        result = $q.when<TResult, TValue>(tValue, (result: TValue) => tResult, (any) => any, (any) => any);

        result = $q.when<TResult, TValue>(promiseTValue, (result: TValue) => tResult);
        result = $q.when<TResult, TValue>(promiseTValue, (result: TValue) => tResult, (any) => any);
        result = $q.when<TResult, TValue>(promiseTValue, (result: TValue) => tResult, (any) => any, (any) => any);

        result = $q.when<TResult, TValue>(tValue, (result: TValue) => promiseTResult);
        result = $q.when<TResult, TValue>(tValue, (result: TValue) => promiseTResult, (any) => any);
        result = $q.when<TResult, TValue>(tValue, (result: TValue) => promiseTResult, (any) => any, (any) => any);

        result = $q.when<TResult, TValue>(promiseTValue, (result: TValue) => promiseTResult);
        result = $q.when<TResult, TValue>(promiseTValue, (result: TValue) => promiseTResult, (any) => any);
        result = $q.when<TResult, TValue>(promiseTValue, (result: TValue) => promiseTResult, (any) => any, (any) => any);
    }
}

let httpFoo: ng.IHttpPromise<number>;
httpFoo.then((x) => {
    // When returning a promise the generic type must be inferred.
    var innerPromise: ng.IPromise<number>;
    return innerPromise;
}).then((x) => {
    // must still be number.
    x.toFixed();
});

httpFoo.success((data, status, headers, config) => {
    const h = headers('test');
    h.charAt(0);
    const hs = headers();
    hs['content-type'].charAt(1);
});

// Deferred signature tests
namespace TestDeferred {
    var any: any;

    interface TResult {
        a: number;
        b: string;
        c: boolean;
    }
    var tResult: TResult;

    var deferred: angular.IDeferred<TResult>;

    // deferred.resolve
    {
        let result: void;
        result = deferred.resolve() as void;
        result = deferred.resolve(tResult) as void;
    }

    // deferred.reject
    {
        let result: void;
        result = deferred.reject();
        result = deferred.reject(any);
    }

    // deferred.notify
    {
        let result: void;
        result = deferred.notify();
        result = deferred.notify(any);
    }

    // deferred.promise
    {
        let result: angular.IPromise<TResult>;
        result = deferred.promise;
    }
}

namespace TestInjector {
    var $injector: angular.auto.IInjectorService;

    $injector.strictDi = true;

    $injector.annotate(() => {});
    $injector.annotate(() => {}, true);
}

// Promise signature tests
namespace TestPromise {
    let result: any;
    var any: any;

    interface TResult {
        a: number;
        b: string;
        c: boolean;
    }
    interface TOther {
        d: number;
        e: string;
        f: boolean;
    }

    var tresult: TResult;
    var tresultPromise: ng.IPromise<TResult>;
    var tresultHttpPromise: ng.IHttpPromise<TResult>;

    var tother: TOther;
    var totherPromise: ng.IPromise<TOther>;
    var totherHttpPromise: ng.IHttpPromise<TOther>;

    var promise: angular.IPromise<TResult>;

    // promise.then
    result = promise.then((result) => any) as angular.IPromise<any>;
    result = promise.then((result) => any, (any) => any) as angular.IPromise<any>;
    result = promise.then((result) => any, (any) => any, (any) => any) as angular.IPromise<any>;

    result = promise.then((result) => result) as angular.IPromise<TResult>;
    result = promise.then((result) => result, (any) => any) as angular.IPromise<TResult>;
    result = promise.then((result) => result, (any) => any, (any) => any) as angular.IPromise<TResult>;
    result = promise.then((result) => tresultPromise) as angular.IPromise<TResult>;
    result = promise.then((result) => tresultPromise, (any) => any) as angular.IPromise<TResult>;
    result = promise.then((result) => tresultPromise, (any) => any, (any) => any) as angular.IPromise<TResult>;
    result = promise.then((result) => tresultHttpPromise) as angular.IPromise<ng.IHttpPromiseCallbackArg<TResult>>;
    result = promise.then((result) => tresultHttpPromise, (any) => any) as angular.IPromise<ng.IHttpPromiseCallbackArg<TResult>>;
    result = promise.then((result) => tresultHttpPromise, (any) => any, (any) => any) as angular.IPromise<ng.IHttpPromiseCallbackArg<TResult>>;

    result = promise.then((result) => tother) as angular.IPromise<TOther>;
    result = promise.then((result) => tother, (any) => any) as angular.IPromise<TOther>;
    result = promise.then((result) => tother, (any) => any, (any) => any) as angular.IPromise<TOther>;
    result = promise.then((result) => totherPromise) as angular.IPromise<TOther>;
    result = promise.then((result) => totherPromise, (any) => any) as angular.IPromise<TOther>;
    result = promise.then((result) => totherPromise, (any) => any, (any) => any) as angular.IPromise<TOther>;
    result = promise.then((result) => totherHttpPromise) as angular.IPromise<ng.IHttpPromiseCallbackArg<TOther>>;
    result = promise.then((result) => totherHttpPromise, (any) => any) as angular.IPromise<ng.IHttpPromiseCallbackArg<TOther>>;
    result = promise.then((result) => totherHttpPromise, (any) => any, (any) => any) as angular.IPromise<ng.IHttpPromiseCallbackArg<TOther>>;

    // promise.catch
    result = promise.catch((err) => any) as angular.IPromise<any>;
    result = promise.catch((err) => tresult) as angular.IPromise<TResult>;
    result = promise.catch((err) => tresultPromise) as angular.IPromise<TResult>;
    result = promise.catch((err) => tresultHttpPromise) as angular.IPromise<ng.IHttpPromiseCallbackArg<TResult>>;
    result = promise.catch((err) => tother) as angular.IPromise<TOther>;
    result = promise.catch((err) => totherPromise) as angular.IPromise<TOther>;
    result = promise.catch((err) => totherHttpPromise) as angular.IPromise<ng.IHttpPromiseCallbackArg<TOther>>;

    // promise.finally
    result = promise.finally(() => any) as angular.IPromise<TResult>;
    result = promise.finally(() => tresult) as angular.IPromise<TResult>;
    result = promise.finally(() => tother) as angular.IPromise<TResult>;
}

function test_angular_forEach() {
    const values: { [key: string]: string } = { name: 'misko', gender: 'male' };
    const log: string[] = [];
    angular.forEach(values, function(value, key) {
        this.push(key + ': ' + value);
    }, log);
    //expect(log).toEqual(['name: misko', 'gender: male']);
}

// angular.element() tests
let element = angular.element('div.myApp');
let scope: ng.IScope = element.scope();
let isolateScope: ng.IScope = element.isolateScope();
isolateScope = element.find('div.foo').isolateScope();
isolateScope = element.children().isolateScope();

// $timeout signature tests
namespace TestTimeout {
    interface TResult {
        a: number;
        b: string;
        c: boolean;
    }
    var fnTResult: (...args: any[]) => TResult;
    var promiseAny: angular.IPromise<any>;
    var $timeout: angular.ITimeoutService;

    // $timeout
    {
        let result: angular.IPromise<any>;
        result = $timeout();
    }
    {
        let result: angular.IPromise<void>;
        result = $timeout(1);
        result = $timeout(1, true);
    }
    {
        let result: angular.IPromise<TResult>;
        result = $timeout(fnTResult);
        result = $timeout(fnTResult, 1);
        result = $timeout(fnTResult, 1, true);
        result = $timeout(fnTResult, 1, true, 1);
        result = $timeout(fnTResult, 1, true, 1, '');
        result = $timeout(fnTResult, 1, true, 1, '', true);
    }

    // $timeout.cancel
    {
        let result: boolean;
        result = $timeout.cancel();
        result = $timeout.cancel(promiseAny);
    }
}

function test_IAttributes(attributes: ng.IAttributes) {
    return attributes;
}

test_IAttributes({
    $normalize(classVal) { return 'foo'; },
    $addClass(classVal) {},
    $removeClass(classVal) {},
    $updateClass(newClass, oldClass) {},
    $set(key, value) {},
    $observe(name: any, fn: any) {
        return fn;
    },
    $attr: {}
});

class SampleDirective implements ng.IDirective {
    restrict = 'A';
    name = 'doh';

    compile(templateElement: ng.IAugmentedJQuery) {
        return {
            post: this.link
        };
    }

    static instance(): ng.IDirective {
        return new SampleDirective();
    }

    link(scope: ng.IScope) {

    }
}

class SampleDirective2 implements ng.IDirective {
    restrict = 'EAC';

    compile(templateElement: ng.IAugmentedJQuery) {
        return {
            pre: this.link
        };
    }

    static instance(): ng.IDirective {
        return new SampleDirective2();
    }

    link(scope: ng.IScope) {

    }
}

angular.module('SameplDirective', []).directive('sampleDirective', SampleDirective.instance).directive('sameplDirective2', SampleDirective2.instance);

angular.module('AnotherSampleDirective', []).directive('myDirective', ['$interpolate', '$q', ($interpolate: ng.IInterpolateService, $q: ng.IQService) => {
    return {
        restrict: 'A',
        link: (scope: ng.IScope, el: ng.IAugmentedJQuery, attr: ng.IAttributes) => {
            $interpolate(attr['test'])(scope);
            $interpolate('', true)(scope);
            $interpolate('', true, 'html')(scope);
            $interpolate('', true, 'html', true)(scope);
            const defer = $q.defer();
            defer.reject();
            defer.resolve();
            defer.promise.then(function(d) {
                return d;
            }).then(function(): any {
                return null;
            }, function(): any {
                return null;
            })
            .catch((): any => {
                return null;
            })
            .finally((): any => {
                return null;
            });
            let promise = new $q((resolve) => {
                resolve();
            });

            promise = new $q((resolve, reject) => {
                reject();
                resolve(true);
            });

            promise = new $q<boolean>((resolver, reject) => {
                resolver(true);
                reject(false);
            });
        }
    };
}]);

// test from https://docs.angularjs.org/guide/directive
angular.module('docsSimpleDirective', [])
    .controller('Controller', ['$scope', function($scope: any) {
        $scope.customer = {
            name: 'Naomi',
            address: '1600 Amphitheatre'
        };
    }])
    .directive('myCustomer', function() {
        return {
            template: 'Name: {{customer.name}} Address: {{customer.address}}'
        };
    });

angular.module('docsTemplateUrlDirective', [])
    .controller('Controller', ['$scope', function($scope: any) {
        $scope.customer = {
            name: 'Naomi',
            address: '1600 Amphitheatre'
        };
    }])
    .directive('myCustomer', function() {
        return {
            templateUrl: 'my-customer.html'
        };
    });

angular.module('docsRestrictDirective', [])
    .controller('Controller', ['$scope', function($scope: any) {
        $scope.customer = {
            name: 'Naomi',
            address: '1600 Amphitheatre'
        };
    }])
    .directive('myCustomer', function() {
        return {
            restrict: 'E',
            templateUrl: 'my-customer.html'
        };
    });

angular.module('docsScopeProblemExample', [])
    .controller('NaomiController', ['$scope', function($scope: any) {
        $scope.customer = {
            name: 'Naomi',
            address: '1600 Amphitheatre'
        };
    }])
    .controller('IgorController', ['$scope', function($scope: any) {
        $scope.customer = {
            name: 'Igor',
            address: '123 Somewhere'
        };
    }])
    .directive('myCustomer', function() {
        return {
            restrict: 'E',
            templateUrl: 'my-customer.html'
        };
    });

angular.module('docsIsolateScopeDirective', [])
    .controller('Controller', ['$scope', function($scope: any) {
        $scope.naomi = { name: 'Naomi', address: '1600 Amphitheatre' };
        $scope.igor = { name: 'Igor', address: '123 Somewhere' };
    }])
    .directive('myCustomer', function() {
        return {
            restrict: 'E',
            scope: {
                customerInfo: '=info'
            },
            templateUrl: 'my-customer-iso.html'
        };
    });

angular.module('docsIsolationExample', [])
    .controller('Controller', ['$scope', function($scope: any) {
        $scope.naomi = { name: 'Naomi', address: '1600 Amphitheatre' };
        $scope.vojta = { name: 'Vojta', address: '3456 Somewhere Else' };
    }])
    .directive('myCustomer', function() {
        return {
            restrict: 'E',
            scope: {
                customerInfo: '=info'
            },
            templateUrl: 'my-customer-plus-vojta.html'
        };
    });

angular.module('docsTimeDirective', [])
    .controller('Controller', ['$scope', function($scope: any) {
        $scope.format = 'M/d/yy h:mm:ss a';
    }])
    .directive('myCurrentTime', ['$interval', 'dateFilter', function($interval: any, dateFilter: any) {

        return {
            link(scope: ng.IScope, element: ng.IAugmentedJQuery, attrs: ng.IAttributes) {
                let format: any,
                    timeoutId: any;

                function updateTime() {
                    element.text(dateFilter(new Date(), format));
                }

                scope.$watch(attrs['myCurrentTime'], function(value: any) {
                    format = value;
                    updateTime();
                });

                element.on('$destroy', function() {
                    $interval.cancel(timeoutId);
                });

                // start the UI update process; save the timeoutId for canceling
                timeoutId = $interval(function() {
                    updateTime(); // update DOM
                }, 1000);
            }
        };
    }]);

angular.module('docsTransclusionDirective', [])
    .controller('Controller', ['$scope', function($scope: any) {
        $scope.name = 'Tobias';
    }])
    .directive('myDialog', function() {
        return {
            restrict: 'E',
            transclude: true,
            templateUrl: 'my-dialog.html'
        };
    });

angular.module('docsTransclusionExample', [])
    .controller('Controller', ['$scope', function($scope: any) {
        $scope.name = 'Tobias';
    }])
    .directive('myDialog', function() {
        return {
            restrict: 'E',
            transclude: true,
            scope: {},
            templateUrl: 'my-dialog.html',
            link(scope: ng.IScope, element: ng.IAugmentedJQuery) {
                scope['name'] = 'Jeff';
            }
        };
    });

angular.module('docsIsoFnBindExample', [])
    .controller('Controller', ['$scope', '$timeout', function($scope: any, $timeout: any) {
        $scope.name = 'Tobias';
        $scope.hideDialog = function() {
            $scope.dialogIsHidden = true;
            $timeout(function() {
                $scope.dialogIsHidden = false;
            }, 2000);
        };
    }])
    .directive('myDialog', function() {
        return {
            restrict: 'E',
            transclude: true,
            scope: {
                close: '&onClose'
            },
            templateUrl: 'my-dialog-close.html'
        };
    });

angular.module('dragModule', [])
    .directive('myDraggable', ['$document', function($document: any) {
        return function(scope: any, element: any, attr: any) {
            let startX = 0, startY = 0, x = 0, y = 0;

            element.css({
                position: 'relative',
                border: '1px solid red',
                backgroundColor: 'lightgrey',
                cursor: 'pointer'
            });

            element.on('mousedown', function(event: any) {
                // Prevent default dragging of selected content
                event.preventDefault();
                startX = event.pageX - x;
                startY = event.pageY - y;
                $document.on('mousemove', mousemove);
                $document.on('mouseup', mouseup);
            });

            function mousemove(event: any) {
                y = event.pageY - startY;
                x = event.pageX - startX;
                element.css({
                    top: y + 'px',
                    left:  x + 'px'
                });
            }

            function mouseup() {
                $document.off('mousemove', mousemove);
                $document.off('mouseup', mouseup);
            }
        };
    }]);

angular.module('docsTabsExample', [])
    .directive('myTabs', function() {
        return {
            restrict: 'E',
            transclude: true,
            scope: {},
            controller($scope: ng.IScope) {
                const panes: any = $scope['panes'] = [];

                $scope['select'] = function(pane: any) {
                    angular.forEach(panes, function(pane: any) {
                        pane.selected = false;
                    });
                    pane.selected = true;
                };

                this.addPane = function(pane: any) {
                    if (panes.length === 0) {
                        $scope['select'](pane);
                    }
                    panes.push(pane);
                };
            },
            templateUrl: 'my-tabs.html'
        };
    })
    .directive('myPane', function() {
        return {
            require: '^myTabs',
            restrict: 'E',
            transclude: true,
            scope: {
                title: '@'
            },
            link(scope: ng.IScope, element: ng.IAugmentedJQuery, attrs: ng.IAttributes, tabsCtrl: any) {
                tabsCtrl.addPane(scope);
            },
            templateUrl: 'my-pane.html'
        };
    });

angular.module('multiSlotTranscludeExample', [])
    .directive('dropDownMenu', function() {
        return {
            transclude: {
                button: 'button',
                list: 'ul',
            },
            link(scope, element, attrs, ctrl, transclude) {
                // without scope
                transclude().appendTo(element);
                transclude(clone => clone.appendTo(element));

                // with scope
                transclude(scope, clone => clone.appendTo(element));
                transclude(scope, clone => clone.appendTo(element), element, 'button');
                transclude(scope, null, element, 'list').addClass('drop-down-list').appendTo(element);
            }
        };
    });

angular.module('componentExample', [])
    .component('counter', {
        require: {ctrl: '^ctrl'},
        bindings: {
            count: '='
        },
        controller: 'CounterCtrl',
        controllerAs: 'counterCtrl',
        template() {
            return '';
        },
        transclude: {
            el: 'target'
        }
    })
    .component('anotherCounter', {
        controller() {},
        require: {
            parent: '^parentCtrl'
        },
        template: '',
        transclude: true
    });

interface ICopyExampleUser {
    name?: string;
    email?: string;
    gender?: string;
}

interface ICopyExampleScope {

    user: ICopyExampleUser;
    master: ICopyExampleUser;
    update: (copyExampleUser: ICopyExampleUser) => any;
    reset: () => any;
}

angular.module('copyExample', [])
    .controller('ExampleController', ['$scope', function($scope: ICopyExampleScope) {
        $scope.master = { };

        $scope.update = function(user) {
            // Example with 1 argument
            $scope.master = angular.copy(user);
        };

        $scope.reset = function() {
            // Example with 2 arguments
            angular.copy($scope.master, $scope.user);
        };

        $scope.reset();
    }]);

namespace locationTests {

    var $location: ng.ILocationService;

    /*
     * From https://docs.angularjs.org/api/ng/service/$location
     */

    // given url http://example.com/#/some/path?foo=bar&baz=xoxo
    const searchObject = $location.search();
    // => {foo: 'bar', baz: 'xoxo'}

    function assert(condition: boolean) {
        if (!condition) {
            throw new Error();
        }
    }

    // set foo to 'yipee'
    $location.search('foo', 'yipee');
    // => $location

    // set foo to 5
    $location.search('foo', 5);
    // => $location

    /*
     * From: https://docs.angularjs.org/guide/$location
     */

    // in browser with HTML5 history support:
    // open http://example.com/#!/a -> rewrite to http://example.com/a
    // (replacing the http://example.com/#!/a history record)
    assert($location.path() === '/a');

    $location.path('/foo');
    assert($location.absUrl() === 'http://example.com/foo');

    assert($location.search() === {});
    $location.search({ a: 'b', c: true });
    assert($location.absUrl() === 'http://example.com/foo?a=b&c');

    $location.path('/new').search('x=y');
    assert($location.url() === 'new?x=y');
    assert($location.absUrl() === 'http://example.com/new?x=y');

    // in browser without html5 history support:
    // open http://example.com/new?x=y -> redirect to http://example.com/#!/new?x=y
    // (again replacing the http://example.com/new?x=y history item)
    assert($location.path() === '/new');
    assert($location.search() === { x: 'y' });

    $location.path('/foo/bar');
    assert($location.path() === '/foo/bar');
    assert($location.url() === '/foo/bar?x=y');
    assert($location.absUrl() === 'http://example.com/#!/foo/bar?x=y');
}

// NgModelController
function NgModelControllerTyping() {
    var ngModel: angular.INgModelController;
    var $http: angular.IHttpService;
    var $q: angular.IQService;

    // See https://docs.angularjs.org/api/ng/type/ngModel.NgModelController#$validators
    ngModel.$validators['validCharacters'] = function(modelValue, viewValue) {
        const value = modelValue || viewValue;
        return /[0-9]+/.test(value) &&
            /[a-z]+/.test(value) &&
            /[A-Z]+/.test(value) &&
            /\W+/.test(value);
    };

    ngModel.$asyncValidators['uniqueUsername'] = function(modelValue, viewValue) {
        const value = modelValue || viewValue;
        return $http.get('/api/users/' + value).
            then(function resolved() {
                return $q.reject('exists');
            }, function rejected() {
                return true;
            });
    };
}

let $filter: angular.IFilterService;

function testFilter() {

    var items: string[];
    $filter('filter')(items, 'test');
    $filter('filter')(items, {name: 'test'});
    $filter('filter')(items, (val, index, array) => {
        return true;
    });
    $filter('filter')(items, (val, index, array) => {
      return true;
    }, (actual, expected) => {
        return actual === expected;
    });
}

function testCurrency() {
    $filter('currency')(126);
    $filter('currency')(126, '$', 2);
}

function testNumber() {
    $filter('number')(167);
    $filter('number')(167, 2);
}

function testDate() {
    $filter('date')(new Date());
    $filter('date')(new Date(), 'yyyyMMdd');
    $filter('date')(new Date(), 'yyyyMMdd', '+0430');
}

function testJson() {
    const json: string = $filter('json')({test: true}, 2);
}

function testLowercase() {
    const lower: string = $filter('lowercase')('test');
}

function testUppercase() {
    const lower: string = $filter('uppercase')('test');
}

function testLimitTo() {
    const limitTo = $filter('limitTo');
    let filtered: number[] = $filter('limitTo')([1, 2, 3], 5);
    filtered = $filter('limitTo')([1, 2, 3], 5, 2);

    let filteredString: string = $filter('limitTo')('124', 4);
    filteredString = $filter('limitTo')(124, 4);
}

function testOrderBy() {
    let filtered: number[] = $filter('orderBy')([1, 2, 3], 'test');
    filtered = $filter('orderBy')([1, 2, 3], 'test', true);
    filtered = $filter('orderBy')([1, 2, 3], ['prop1', 'prop2']);
    filtered = $filter('orderBy')([1, 2, 3], (val: number) => 1);
    let filtered2: string[] = $filter('orderBy')(['1', '2', '3'], (val: string) => 1);
    filtered2 = $filter('orderBy')(['1', '2', '3'], [
        (val: string) => 1,
        (val: string) => 2
    ]);
}

function testDynamicFilter() {
    // Test with separate variables
    const dateFilter = $filter('date');
    const myDate = new Date();
    dateFilter(myDate , 'EEE, MMM d');

    // Test with dynamic name
    const filterName = 'date';
    const dynDateFilter = $filter<ng.IFilterDate>(filterName);
    dynDateFilter(new Date());
}

type MyCustomFilter = (value: string) => string;

function testCustomFilter() {
    const filterCustom = $filter<MyCustomFilter>('custom');
    const filtered: string = filterCustom('test');
}

function parseTyping() {
    var $parse: angular.IParseService;
    const compiledExp = $parse('a.b.c');
    if (compiledExp.constant) {
        return compiledExp({});
    } else if (compiledExp.literal) {
        return compiledExp({}, {a: {b: {c: 42}}});
    }
}

function parseWithParams() {
    var $parse: angular.IParseService;
    const compiledExp1 = $parse('a.b.c', () => null);
    const compiledExp2 = $parse('a.b.c', null, false);
}

function doBootstrap(element: Element | JQuery, mode: string): ng.auto.IInjectorService {
    if (mode === 'debug') {
        return angular.bootstrap(element, ['main', function($provide: ng.auto.IProvideService) {
            $provide.decorator('$rootScope', function($delegate: ng.IRootScopeService) {
                $delegate['debug'] = true;
            });
        }, 'debug-helpers'], {
            strictDi: true
        });
    }
    return angular.bootstrap(element, ['main'], {
        strictDi: false
    });
}

function testIHttpParamSerializerJQLikeProvider() {
    var serializer: angular.IHttpParamSerializer;
    serializer({
        a: 'b'
    });
}
