import os
import time
import re
import random
from playwright.sync_api import sync_playwright

def sanitize_filename(text):
    return re.sub(r'[^\w\s-]', '', text).strip()

def scrape_page_range(base_url, start_page=3, end_page=5, folder="alternative_models"):
    if not os.path.exists(folder):
        os.makedirs(folder)

    with sync_playwright() as p:
        # headless=False lets you watch the progress
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(viewport={'width': 1280, 'height': 720})
        page = context.new_page()

        # The range includes the start_page, but we add +1 to end_page to include it
        for page_num in range(start_page, end_page + 1):
            target_url = f"{base_url}&page={page_num}"
            print(f"\n--- 📂 Processing Page {page_num} of {end_page} ---")
            
            page.goto(target_url, wait_until="networkidle")

            # Scroll to load the AJAX content
            print("Scrolling to load all images...")
            for _ in range(8): 
                page.mouse.wheel(0, 2500)
                time.sleep(random.uniform(1.0, 1.8))

            links = page.locator("a.ms-image-list__media").all()
            print(f"Found {len(links)} images. Starting downloads...")

            for i, link in enumerate(links):
                img_element = link.locator("img")
                if img_element.count() > 0:
                    raw_title = img_element.get_attribute("alt") or img_element.get_attribute("title") or "untitled"
                    clean_title = sanitize_filename(raw_title)
                    src = img_element.get_attribute("src") or img_element.get_attribute("data-src")
                    
                    if src:
                        try:
                            # Convert thumbnail URL to Full Resolution URL
                            high_res = src.replace("/thumbs/", "/full/").split('?')[0]
                            response = page.request.get(high_res)
                            
                            # Filename includes page number to keep them sorted
                            file_name = f"P{page_num}_{i:02d}_{clean_title[:50]}.jpg"
                            file_path = os.path.join(folder, file_name)
                            
                            with open(file_path, "wb") as f:
                                f.write(response.body())
                                
                        except Exception:
                            continue

            # Pause between pages to look "human"
            if page_num < end_page:
                wait_time = random.uniform(4, 7)
                print(f"Finished page {page_num}. Waiting {wait_time:.1f}s before Page {page_num + 1}...")
                time.sleep(wait_time)

        browser.close()
        print(f"\n✅ Batch complete! Check the '{folder}' folder.")

# The URL from your request
#url = "https://modelsociety.com/images?sort=newest&filter=allimages&cat=13"
url = "https://modelsociety.com/images?sort=newest&filter=allimages&cat=37"

# Run it for pages 3, 4, and 5
scrape_page_range(url, start_page=1, end_page=10)