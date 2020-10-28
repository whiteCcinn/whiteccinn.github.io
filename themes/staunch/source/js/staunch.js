$(window).scroll(function() {
    if($(document).scrollTop() > 60) {
        $('.header').addClass("header-toggle")
    } else {
        $('.header').removeClass("header-toggle")
    }
})

// Add second-level menu mark
$('.nav-menu-list-item').each(function () {
    if ($(this).find('.nav-menu-list-child').length > 0) {
        $(this).addClass('top-level-menu');
    }
});

$(document).on('click focus', '.header-hamburger', function() {
    $('#nav-menu').slideToggle("slow");
    $('#nav-menu').toggle();
    $('#nav-menu').toggle();
})

$(document).ready(function(){
    // Caption
    $('.article-inner').each(function(i) {
        $(this).find('img').each(function() {
            if (this.alt && !(!!$.prototype.justifiedGallery && $(this).parent('.justified-gallery').length)) {
                $(this).after('<span class="caption">' + this.alt + '</span>');
                
            }

            if ($(this).parent().prop("tagName") !== 'A') {
                $(this).wrap('<a href="' + this.src + '" title="' + this.alt + '" data-fancybox="gallery"></a>');
            }
        });

    });

    $('.justified-gallery').each(function() {
        $(this).find('a').each(function() {
            $(this).attr("data-fancybox", "gallery");
        })
    })
    
    if (!!$.prototype.justifiedGallery) {  // if justifiedGallery method is defined
        var options = {
            rowHeight: 140,
            margins: 4,
            lastRow: 'justify'
        };
        $('.justified-gallery').justifiedGallery(options);
    }
})

$(document).on('click', '.reward-btn', function() {
    $('.reward-content').slideToggle("slow");
    $('.reward-content').toggle();
    $('.reward-content').toggle();
})

$(document).on('click', '.share-all-btn', function() {
    $('.share-alone').slideToggle("slow");
    $('.share-alone').toggle();
    $('.share-alone').toggle();
})

$(document).on('click', '.fa-list-ol', function() {
    $('.toc').slideToggle("slow");
    $('.toc').toggle();
    $('.toc').toggle();
})

// To top button
$(".top").on('click', function () {
    $('body, html').animate({ scrollTop: 0 }, 600);
});