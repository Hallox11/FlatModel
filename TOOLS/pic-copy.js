const https = require('https');
const fs = require('fs');
const path = require('path');

// Your list of image URLs
const urls = [
    "https://images.wallpaperscraft.com/image/single/silhouette_bw_snowfall_136846_1280x800.jpg",
"https://images.wallpaperscraft.com/image/single/roof_rain_umbrella_131381_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/tree_bird_bw_162135_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/couple_hugs_art_140777_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/flower_sunflower_artificial_119551_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/trees_forest_nature_1247196_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/silhouette_fog_loneliness_125988_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/planet_saturn_satellite_143820_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/astronaut_gravity_spacesuit_138001_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/railway_train_station_134586_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/glow_lines_circles_141767_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/girl_river_sunset_1067581_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/moon_clouds_night_1432004_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/silhouette_lane_night_139127_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/rope_thread_breakage_115379_300x168.jpg",
"https://images.wallpaperscraft.com/image/single/forest_fog_trees_126479_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/animals_tree_branch_129397_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/silhouette_sunset_birds_145330_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/cat_roof_city_130750_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/skeleton_skull_mantle_130517_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/silhouette_portal_glow_141493_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/guy_birds_art_131629_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/relief_landscape_alien_139296_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/knight_horse_armor_309092_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/children_friends_bw_122854_300x168.jpg",
"https://images.wallpaperscraft.com/image/single/butterfly_flower_black_and_white_357915_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/fire_bw_coals_135546_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/robot_cyborg_rain_142115_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/rose_stones_fragments_139704_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/spray_face_water_126492_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/puzzle_3d_glitter_122995_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/silhouettes_mannequins_drops_214100_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/wolf_predator_black_135469_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/tiger_graffiti_street_art_137823_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/birds_hearts_love_126122_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/couple_love_bench_116175_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/heart_wall_art_120600_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/hearts_red_love_126164_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/heart_candy_red_203644_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/couple_kiss_love_138973_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/love_inscription_confession_125700_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/wall_graffiti_heart_126402_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/drops_rain_glass_126330_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/lime_fruit_citrus_194583_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/grass_dew_drops_193835_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/branches_leaves_drops_151820_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/cyborg_mask_cyberpunk_150427_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/boy_street_rain_140704_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/train_snow_forest_197247_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/man_street_night_196296_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/smile_helmet_glasses_116692_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/umbrella_red_girl_119161_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/bouquet_flowers_vase_149811_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/man_illusion_fog_141883_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/traffic_light_snow_blizzard_159779_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/flower_white_bud_140169_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/rowan_berries_frosty_134693_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/pattern_branches_leaves_144085_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/graffiti_lines_colorful_223889_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/sloths_relaxation_pattern_158667_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/escalator_metro_station_199634_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/spider_web_drops_closeup_118826_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/child_cat_window_133558_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/cat_glance_pendant_170867_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/girl_art_cat_132215_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/girl_art_flower_130023_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/city_crowd_silhouettes_136041_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/man_paint_sky_129261_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/drops_rain_glass_120628_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/forest_fog_trees_140541_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/girl_musician_guitar_149459_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/calla_lily_arum_lily_flower_123935_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/lake_boat_minimalism_139606_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/rose_rain_drops_133566_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/cat_starry_sky_night_131748_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/cherries_cherry_berry_122190_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/kite_flight_sky_122430_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/city_futurism_night_129887_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/waterfall_cliff_stone_141850_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/lines_shapes_shadows_1186963_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/forest_fog_trees_127289_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/silhouette_staircase_bw_125593_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/stones_bw_nature_157712_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/man_cube_wall_1132584_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/girl_hat_bw_132197_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/forest_fog_deer_129931_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/city_futurism_cyberpunk_131976_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/lion_bw_big_cat_152070_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/cat_blueeyed_muzzle_132088_300x168.jpg",
"https://images.wallpaperscraft.com/image/single/lake_tree_lonely_139044_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/rain_umbrella_bw_123587_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/trees_river_reflection_134973_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/butterfly_flower_black_background_74198_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/cosmos_flower_closeup_121820_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/space_planet_surface_shadow_46631_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/planet_space_universe_129992_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/branch_birds_owls_scarf_94136_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/fog_forest_path_125819_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/flower_metal_form_figure_15270_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/tree_silhouette_night_202532_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/tiger_art_fantastic_129642_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/face_hair_girl_lips_57250_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/silhouette_tree_blur_141357_1280x800.jpg",
"https://images.wallpaperscraft.com/image/single/lightning_forest_spruce_179460_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/star_light_shine_sky_planet_imagination_47470_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/hologram_pattern_colorful_142690_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/3d_abstract_fractal_81388_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/tree_shape_shadow_colored_46542_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/tree_bird_drawing_nature_20311_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/abstraction_paint_stains_166498_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/fractal_pattern_flower_146354_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/cosmos_flower_yellow_123758_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/liquid_spray_reflection_122974_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/girl_rain_walk_mood_pier_fog_54377_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/forest_fog_trees_134389_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/planet_space_universe_130184_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/whale_ocean_underwater_world_130315_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/cave_ball_silhouette_147313_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/crows_wires_birds_118095_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/lion_art_patterned_118637_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/man_silhouette_birds_117142_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/ants_art_love_141080_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/robot_cyborg_binary_code_126175_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/europe_park_walls_hdr_73505_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/traffic_light_fantastic_art_132609_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/fog_tree_art_125815_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/cube_paper_cut_strips_19929_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/dandelion_fluff_plant_stalk_49392_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/clipart_person_paint_122954_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/rose_flower_fire_151200_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/egg_shell_shape_light_43428_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/horse_shadow_smoke_dust_color_16819_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/monster_mask_creature_160895_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/shape_edges_highlights_205864_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/branches_bloom_macro_120587_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/candle_fire_burn_148009_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/pot_plants_sprout_74266_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/cyclist_minimalism_sky_128078_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/tree_snow_minimalism_126714_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/fish_art_wall_paint_118119_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/street_puddle_reflection_139688_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/close-up_drop_black_blue_rain_4502_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/boat_lake_fog_139778_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/circuit_processor_chip_163424_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/tulip_flower_yellow_142548_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/tulips_flowers_shade_drops_107777_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/bridge_fog_city_132817_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/bluebells_wildflowers_summer_124835_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/heart_rendering_3d_circle_95582_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/canyon_bw_layers_138077_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/flower_bud_red_134924_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/planet_asteroids_space_142894_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/ballerina_silhouette_dance_118897_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/street_night_fog_193941_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/dandelion_butterflies_photoshop_130483_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/owl_art_minimalism_105576_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/mesh_optical_illusion_illusion_127311_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/drops_surface_bw_117448_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/heart_melody_music_light_88521_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/flight_balloon_sky_86980_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/silhouettes_couple_hugs_121587_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/shards_stone_background_light_85542_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/rose_bud_petals_120604_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/flower_bottle_vase_158038_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/flower_plant_macro_drops_96795_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/stains_light_dark_background_91680_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/umbrella_red_sea_art_119667_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/glass_drop_rain_moisture_9427_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/cat_picture_window_silhouette_70090_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/squares_background_shadow_83510_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/silhouettes_love_tree_128864_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/sakura_flowers_pink_154053_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/sea_horizon_minimalism_127411_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/fluid_white_blue_hue_38_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/balloon_rendering_volume_shape_reflection_104226_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/cube_dark_texture_shape_119956_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/cube_fire_dark_light_alloy_36536_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/rose_stones_fragments_139704_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/butterfly_leaves_wings_134436_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/cube_3d_graphics_black_gray_background_3d_graphics_74555_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/orchid_flower_petals_pink_116453_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/fog_forest_path_125819_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/eyes_black_dark_130416_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/cherry_berry_3d_140785_1280x720.jpg",
"https://images.wallpaperscraft.com/image/single/hands_couple_bw_tenderness_119560_1280x720.jpg"
];

const downloadImage = (url) => {
    return new Promise((resolve, reject) => {
        const filename = path.basename(url);
        const filePath = path.join(__dirname, 'images', filename);
        const file = fs.createWriteStream(filePath);

        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
                return;
            }

            response.pipe(file);

            file.on('finish', () => {
                file.close();
                console.log(`✅ Downloaded: ${filename}`);
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(filePath, () => {}); // Delete the partial file on error
            reject(err);
        });
    });
};

const main = async () => {
    // Ensure the directory exists
    if (!fs.existsSync('./images')) {
        fs.mkdirSync('./images');
    }

    console.log(`Starting download of ${urls.length} images...`);

    // Download them in small batches to avoid hitting rate limits
    const batchSize = 5; 
    for (let i = 0; i < urls.length; i += batchSize) {
        const batch = urls.slice(i, i + batchSize).map(url => downloadImage(url));
        await Promise.allSettled(batch);
    }

    console.log('--- All downloads complete! ---');
};

main();