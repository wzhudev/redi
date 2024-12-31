

# [0.17.0](https://github.com/wzhudev/redi/compare/v0.16.2...v0.17.0) (2024-12-31)


### Features

* add onDispose ([#33](https://github.com/wzhudev/redi/issues/33)) ([18daf03](https://github.com/wzhudev/redi/commit/18daf037b51308cbfb447270f5e18cd9614a5a4f))

## [0.16.2](https://github.com/wzhudev/redi/compare/v0.16.1...v0.16.2) (2024-12-13)


### Bug Fixes

* fix optional looking up ([#32](https://github.com/wzhudev/redi/issues/32)) ([84e3b79](https://github.com/wzhudev/redi/commit/84e3b7904e4fc0f2fb439d2e998d0333db425f6a))

## [0.16.1](https://github.com/wzhudev/redi/compare/v0.16.0...v0.16.1) (2024-07-31)


### Features

* support has API on accessor ([#29](https://github.com/wzhudev/redi/issues/29)) ([4cb5c21](https://github.com/wzhudev/redi/commit/4cb5c21d40aae66f199d3c06ee17e6e7f81fd097))

# [0.16.0](https://github.com/hullis/redi/compare/0.15.2...v0.16.0) (2024-07-10)


### Bug Fixes

* fix useClass onInstantiation not running ([#28](https://github.com/hullis/redi/issues/28)) ([c80535d](https://github.com/hullis/redi/commit/c80535dba9cb888ab0cc605e8b9492ea886a203f))
* optimize error message ([3c3f66c](https://github.com/hullis/redi/commit/3c3f66cc540ab7a59c603ba0b13e98c58d1348f9))
* **react:** fix react disposion error ([f3f773f](https://github.com/hullis/redi/commit/f3f773f748721733065ab9f656b85e72657109de))


### Features

* set dependencies with start index ([c2740b6](https://github.com/hullis/redi/commit/c2740b677d3f2668afbc1755e668d6431af7c1a5))



## [0.15.2](https://github.com/hullis/redi/compare/0.15.0...0.15.2) (2024-05-17)


### Bug Fixes

* fix ensure error catch by self ([#23](https://github.com/hullis/redi/issues/23)) ([368710a](https://github.com/hullis/redi/commit/368710a7b33a41574a5e75e6c8f19c170dd8c8c4))
* not throw error in SSR environment ([7334ab3](https://github.com/hullis/redi/commit/7334ab33342ecb895c38364a4f58ef4725546609))



# [0.15.0](https://github.com/hullis/redi/compare/e38a4ecbb09b5db75c45344cf353c6ac0a902842...0.15.0) (2024-05-14)


### Bug Fixes

* fix get value on optional ([cd631fb](https://github.com/hullis/redi/commit/cd631fb52c9f7e0d5454a79a7f60c90c8090fd7d))
* fix is async hook util function ([0fccc1a](https://github.com/hullis/redi/commit/0fccc1a81086ed5925b84e8572077f4dd99e3864))
* fix react type ([#17](https://github.com/hullis/redi/issues/17)) ([47e2acf](https://github.com/hullis/redi/commit/47e2acf3e2dcfd7f86bd1daf52b74af77e90c1d2))
* remove calling to window to support SSR ([d348eee](https://github.com/hullis/redi/commit/d348eee85e474714a45bf52ee7c76af131adecd9))


### Features

* add has API ([9f8e3a1](https://github.com/hullis/redi/commit/9f8e3a11c372421fa6f579ef75e450576e338ab4))
* add invoke API ([8906d3d](https://github.com/hullis/redi/commit/8906d3dac3240a4c1a5ba8e91517b9a23f0cdb69))
* add useObservable ([#22](https://github.com/hullis/redi/issues/22)) ([b894be7](https://github.com/hullis/redi/commit/b894be7c19af75a877479282e641145c03798ee3))
* export IAccessor interface ([ae7eddd](https://github.com/hullis/redi/commit/ae7eddd7459ac6d15f26c4a9b0f9b369e11e0b2c))
* expose isDisposable ([988d908](https://github.com/hullis/redi/commit/988d9080024eb75dbed76c18abf72170fac623b6))
* not auto get singleton dependencies ([#14](https://github.com/hullis/redi/issues/14)) ([3ed322a](https://github.com/hullis/redi/commit/3ed322a12802795406bfd0165e9a63586ab2e987))
* release 0.13.4 ([9afe926](https://github.com/hullis/redi/commit/9afe92613a334f4957c20e177d63a220f3f1bba5))
* remove singleton API ([615ef31](https://github.com/hullis/redi/commit/615ef31695874138ef96e09baf999332ed215bc6))
* report dependency missing for class and factory ([#18](https://github.com/hullis/redi/issues/18)) ([195c751](https://github.com/hullis/redi/commit/195c751bf8caacc52f5c8aeb259026b6847bfa4c))
* show chain on DependencyNotFoundError ([aa0440b](https://github.com/hullis/redi/commit/aa0440bc29e8860a8de71864a3141150b2ab683b))
* show resolution chain on resolving error ([#19](https://github.com/hullis/redi/issues/19)) ([b803be9](https://github.com/hullis/redi/commit/b803be9182533c3b5a20f8da86ca83675ee85b03))
* support use-existing ([#20](https://github.com/hullis/redi/issues/20)) ([bc1388c](https://github.com/hullis/redi/commit/bc1388cf5931c92a1839c2a25f3b49700a29eb08))
* update add API ([8ac61c3](https://github.com/hullis/redi/commit/8ac61c3441ee991338200004f7724fc08806f6a6))
* update error info ([3cf3078](https://github.com/hullis/redi/commit/3cf30784523995c3f9b08ac5199cd194d307fe25))


### Performance Improvements

* remove unnecessary instantiation ([#12](https://github.com/hullis/redi/issues/12)) ([e38a4ec](https://github.com/hullis/redi/commit/e38a4ecbb09b5db75c45344cf353c6ac0a902842))


### BREAKING CHANGES

* singletons will not get by root injectors
automatically
